'use strict';

// Importer les modèles
const { VoiceNote, User, Reaction, Comment, Sequelize } = require('../models');
const { uploadVoiceNote } = require('../utils/upload');
const fs = require('fs').promises;
const path = require('path');
const Op = Sequelize.Op;

// === Créer une nouvelle note vocale ===
exports.createVoiceNote = [
  uploadVoiceNote.single('audio'),
  async (req, res, next) => {
    console.log('[CreateVoiceNote] Start processing request.');
    console.log('[CreateVoiceNote] Request Body:', req.body);
    console.log('[CreateVoiceNote] Request File:', req.file);
    try {
      if (!req.file) { return res.status(400).json({ status: 'fail', message: req.multerError || 'Fichier audio requis non fourni ou type invalide.' }); }
      if (!req.user || !req.user.id) { return res.status(401).json({ status: 'fail', message: 'Authentification échouée ou ID utilisateur manquant.' }); }
      const userId = req.user.id;
      const { duration, description = '' } = req.body;
      const parsedDuration = parseInt(duration, 10);
      if (isNaN(parsedDuration) || parsedDuration <= 0) {
        if (req.file?.path) await fs.unlink(req.file.path).catch(err => console.error("Error deleting file after duration validation fail:", err));
        return res.status(400).json({ status: 'fail', message: 'La durée doit être un nombre entier positif.' });
      }
      const maxDuration = 60;
      if (parsedDuration > maxDuration) {
        if (req.file?.path) await fs.unlink(req.file.path).catch(err => console.error("Error deleting file after duration validation fail:", err));
        return res.status(400).json({ status: 'fail', message: `La durée ne peut pas dépasser ${maxDuration} secondes.` });
      }
      const voiceNoteData = { user_id: userId, audio_url: `/uploads/voice_notes/${req.file.filename}`, duration: parsedDuration, description: description };
      const voiceNote = await VoiceNote.create(voiceNoteData);
      const createdVoiceNote = await VoiceNote.findByPk(voiceNote.id, { include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }] });
      if (!createdVoiceNote) {
           console.warn(`[CreateVoiceNote] Failed to retrieve created note ID ${voiceNote.id} with user info immediately.`);
           return res.status(201).json({ status: 'partial_success', message: 'Note vocale créée, mais impossible de récupérer les détails complets immédiatement.', data: { voiceNote: voiceNote.toJSON() } });
      }
      res.status(201).json({ status: 'success', message: 'Note vocale créée avec succès.', data: { voiceNote: createdVoiceNote.toJSON() } }); // Use toJSON()
    } catch (error) {
      console.error("[CreateVoiceNote] Error:", error);
      if (req.file?.path) {
          await fs.unlink(req.file.path).catch(err => console.error("Error deleting file after create error:", err));
      }
      next(error); 
    }
  }
];




// === Obtenir les détails d'une note vocale par ID ===
exports.getVoiceNoteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const voiceNote = await VoiceNote.findByPk(id, {
        include: [
            { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
            { model: Reaction, as: 'reactions', attributes: ['id', 'user_id', 'emoji'], required: false },
            { 
                model: Comment,
                as: 'comments',
                attributes: ['id', 'text', 'user_id', 'createdAt'],
                required: false,
                order: [['createdAt', 'ASC']],
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'username', 'avatar']
                    }
                ]
            }
        ]
    });
    if (!voiceNote) { return res.status(404).json({ status: 'fail', message: 'Note vocale non trouvée.' }); }
    res.status(200).json({ status: 'success', data: { voiceNote: voiceNote.toJSON() } }); // Use toJSON()
  } catch (error) {
    console.error(`[GetVoiceNoteById Error ID ${req.params.id}]:`, error);
    next(error);
  }
};


// === Supprimer une note vocale ===
exports.deleteVoiceNote = async (req, res, next) => {
   try {
    const { id } = req.params;
    const requestingUserId = req.user?.id;
    if (!requestingUserId) { return res.status(401).json({ status: 'fail', message: 'Authentification requise pour supprimer.' }); }
    const voiceNote = await VoiceNote.findByPk(id);
    if (!voiceNote) { return res.status(404).json({ status: 'fail', message: 'Note vocale non trouvée.' }); }
    if (voiceNote.user_id !== requestingUserId) { return res.status(403).json({ status: 'fail', message: 'Action non autorisée.' }); }
    const relativeFilePath = voiceNote.audio_url;
    await voiceNote.destroy(); // Supprime la note et potentiellement les réactions/commentaires en cascade si configuré
    console.log(`[DeleteVoiceNote] Note ID ${id} supprimée de la DB.`);
    if (relativeFilePath && typeof relativeFilePath === 'string' && relativeFilePath.startsWith('/uploads/')) {
      // Chemin plus sûr - suppose que les uploads sont dans public/uploads/... par rapport à la racine du projet
      const absoluteFilePath = path.join(__dirname, '..', 'public', relativeFilePath);
      console.log(`[DeleteVoiceNote] Tentative de suppression fichier: ${absoluteFilePath}`);
      try { await fs.unlink(absoluteFilePath); console.log(`[DeleteVoiceNote] Fichier ${absoluteFilePath} supprimé.`); }
      catch (fileError) { if (fileError.code === 'ENOENT') { console.warn(`[DeleteVoiceNote] Fichier ${absoluteFilePath} non trouvé (déjà supprimé?).`); } else { console.error(`Erreur suppression fichier ${absoluteFilePath} (Note ID ${id}):`, fileError); } }
    } else { console.warn(`[DeleteVoiceNote] Chemin de fichier invalide ou manquant pour note ID ${id}: ${relativeFilePath}`); }
    res.status(204).send(); // Succès sans contenu
  } catch (error) {
      console.error(`[DeleteVoiceNote Error ID ${req.params.id}]:`, error);
      next(error);
  }
};


// === ====> Obtenir les notes vocales avec getVoiceNotes <==== ===
exports.getVoiceNotes = async (req, res, next) => {
  console.log("[getVoiceNotes - Main Feed] Start processing request.");
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC', search } = req.query;
    const offset = (page - 1) * limit;

    console.log(`[getVoiceNotes - Main Feed] Params: page=${page}, limit=${limit}, sortBy=${sortBy}, order=${order}, search=${search || 'none'}`);

    // --- Configuration Tri (inchangée) ---
    const allowedSortBy = ['createdAt', 'reactionCount'];
    let sortField = allowedSortBy.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = ['ASC', 'DESC'].includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
    const dialect = VoiceNote.sequelize.options.dialect;
    const quote = (identifier) => dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
    const reactionsTable = quote(Reaction.tableName || 'reactions');
    const reactionFkColumn = quote('voice_note_id');
    const voiceNoteAlias = quote(VoiceNote.name); // Utilise le nom du modèle (plus sûr que 'VoiceNote')
    const voiceNotePkColumn = quote('id');
    const reactionCountLiteral = Sequelize.literal(`(SELECT COUNT(*) FROM ${reactionsTable} WHERE ${reactionsTable}.${reactionFkColumn} = ${voiceNoteAlias}.${voiceNotePkColumn})`);
    let orderClause = [];
    if (sortField === 'reactionCount') {
        orderClause = [[Sequelize.literal('reactionCount'), sortOrder], ['created_at', 'DESC']];
    } else {
        const dbColumnName = sortBy === 'createdAt' ? 'created_at' : sortBy;
        if (VoiceNote.rawAttributes[dbColumnName]) { orderClause = [[dbColumnName, sortOrder]]; }
        else { orderClause = [['created_at', 'DESC']]; }
    }
    console.log("[getVoiceNotes - Main Feed] Order clause:", orderClause);

    // Construction de la clause WHERE pour la recherche 
    let whereClause = {}; // Commence par un objet vide
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`; // Ajoute les wildcards pour LIKE
      console.log(`[getVoiceNotes - Main Feed] Applying search filter: ${searchTerm}`);
      whereClause = {
        [Op.or]: [
          // Recherche dans la description de la note vocale (sensible à la casse par défaut selon DB)
          { description: { [Op.like]: searchTerm } },
          // Recherche dans le username de l'utilisateur associé
          { '$user.username$': { [Op.like]: searchTerm } }
          
        ]
      };
    }

    // --- Requête Principale AVEC LA CLAUSE WHERE ---
    const findOptions = {
      where: whereClause, 
      attributes: {
          include: [ [reactionCountLiteral, 'reactionCount'] ],
      },
      include: [
          // L'include User est essentiel pour la recherche par username
          {
              model: User,
              as: 'user', 
              attributes: ['id', 'username', 'avatar'],
              required: !!(search) 
          },
          { model: Reaction, as: 'reactions', attributes: ['id', 'user_id', 'emoji'], required: false },
          {
              model: Comment,
              as: 'comments',
              attributes: ['id', 'text', 'user_id', 'createdAt'],
              required: false,
              order: [['createdAt', 'ASC']],
              include: [
                  { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }
              ]
          }
      ],
      order: orderClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      distinct: true, 
    };

    // Exécute la requête pour obtenir les lignes et le compte total filtré
    const { count, rows: voiceNotes } = await VoiceNote.findAndCountAll(findOptions);

    const totalItems = await VoiceNote.count({
        where: whereClause,
        include: [ 
            { model: User, as: 'user', required: !!(search) }
        ],
        distinct: true, 
    });


    console.log(`[getVoiceNotes - Main Feed] Found ${count} rows matching criteria (before distinct/limit), distinct notes matching: ${voiceNotes.length}. Total items matching filter: ${totalItems}`);

    res.status(200).json({
      status: 'success',
      results: voiceNotes.length,
      totalVoiceNotes: totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page, 10),
      data: {
        voiceNotes: voiceNotes.map(vn => vn.toJSON())
      }
    });
    console.log("[getVoiceNotes - Main Feed] Success response sent.");
  } catch (error) {
    console.error("Erreur détaillée dans getVoiceNotes (Main Feed):", error);
    if (error instanceof Sequelize.BaseError) {
        console.error("Erreur Sequelize:", error.message);
        if (error.original) { console.error("Erreur SQL Originale:", error.original.message || error.original); }
    }
    next(error);
  }
};

// ===> "Mes Notes" (filtrées par user) <===
exports.getMyVoiceNotes = async (req, res, next) => {
  console.log('[GetMyVoiceNotes] Start processing request.');
  try {
    if (!req.user || !req.user.id) { return res.status(401).json({ status: 'fail', message: 'Authentification requise.' }); }
    const userId = req.user.id;
    console.log(`[GetMyVoiceNotes] Fetching notes for User ID: ${userId}`);
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    // Ajoutez les includes nécessaires ici aussi si besoin (commentaires, réactions?)
    const { count, rows: voiceNotes } = await VoiceNote.findAndCountAll({
        where: { user_id: userId },
        include: [
            // Ajoutez les includes pour réactions/commentaires si nécessaire pour cette vue
            { model: Reaction, as: 'reactions', attributes: ['id', 'user_id', 'emoji'], required: false },
        ],
        order: [[sortBy === 'createdAt' ? 'created_at' : sortBy, order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        distinct: true
    });
    const totalItems = await VoiceNote.count({ where: { user_id: userId } }); // Count spécifique
    res.status(200).json({
        status: 'success', results: voiceNotes.length, totalVoiceNotes: totalItems,
        totalPages: Math.ceil(totalItems / limit), currentPage: parseInt(page, 10),
        data: { voiceNotes: voiceNotes.map(vn => vn.toJSON()) }
    });
     console.log('[GetMyVoiceNotes] Success response sent.');
  } catch (error) {
    console.error(`[GetMyVoiceNotes Error for User ${req.user?.id}]:`, error);
    next(error);
  }
};

