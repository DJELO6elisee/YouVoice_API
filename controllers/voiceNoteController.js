'use strict';

// Importer les modèles
const { VoiceNote, User, Reaction, Comment, Sequelize } = require('../models');
// --- MODIFICATION IMPORT UPLOAD ---
const { uploadVoiceNote } = require('../utils/upload');
const fs = require('fs').promises;
const path = require('path');
const Op = Sequelize.Op;

// === Créer une nouvelle note vocale ===
// (INCHANGÉ - Gardez votre fonction createVoiceNote ici)
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
      const maxDuration = 300;
      if (parsedDuration > maxDuration) {
        if (req.file?.path) await fs.unlink(req.file.path).catch(err => console.error("Error deleting file after duration validation fail:", err));
        return res.status(400).json({ status: 'fail', message: `La durée ne peut pas dépasser ${maxDuration} secondes.` });
      }
      const voiceNoteData = { user_id: userId, audio_url: `/uploads/voice_notes/${req.file.filename}`, duration: parsedDuration, description: description };
      const voiceNote = await VoiceNote.create(voiceNoteData);
      const createdVoiceNote = await VoiceNote.findByPk(voiceNote.id, { include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }] });
      if (!createdVoiceNote) {
          // Should not happen often, but handle it
           console.warn(`[CreateVoiceNote] Failed to retrieve created note ID ${voiceNote.id} with user info immediately.`);
           return res.status(201).json({ status: 'partial_success', message: 'Note vocale créée, mais impossible de récupérer les détails complets immédiatement.', data: { voiceNote: voiceNote.toJSON() } });
      }
      res.status(201).json({ status: 'success', message: 'Note vocale créée avec succès.', data: { voiceNote: createdVoiceNote.toJSON() } }); // Use toJSON()
    } catch (error) {
      console.error("[CreateVoiceNote] Error:", error);
      // Try to delete uploaded file on error
      if (req.file?.path) {
          await fs.unlink(req.file.path).catch(err => console.error("Error deleting file after create error:", err));
      }
      next(error); // Pass error to global error handler
    }
  }
];


// ===> SUPPRIMEZ L'ANCIENNE FONCTION getVoiceNotes QUI ÉTAIT ICI <===


// === Obtenir les détails d'une note vocale par ID ===
// (INCHANGÉ - Gardez votre fonction getVoiceNoteById ici)
exports.getVoiceNoteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    // ===> AJOUT INCLUDE Comment et User imbriqué ici aussi pour la cohérence <===
    const voiceNote = await VoiceNote.findByPk(id, {
        include: [
            { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
            { model: Reaction, as: 'reactions', attributes: ['id', 'user_id', 'emoji'], required: false },
            { // Inclure les commentaires pour la vue détail
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
// (INCHANGÉ - Gardez votre fonction deleteVoiceNote ici)
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


// === ====> CETTE FONCTION EST MAINTENANT LA BONNE POUR LE FEED <==== ===
// === ====> RENOMMÉE de getMyVoiceNotes à getVoiceNotes <==== ===
exports.getVoiceNotes = async (req, res, next) => {
  console.log("[getVoiceNotes - Main Feed] Start processing request."); // Log pour confirmer
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    const allowedSortBy = ['createdAt', 'reactionCount'];
    let sortField = allowedSortBy.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = ['ASC', 'DESC'].includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
    console.log(`[getVoiceNotes - Main Feed] Params: page=${page}, limit=${limit}, sortBy=${sortField}, order=${sortOrder}`);

    const dialect = VoiceNote.sequelize.options.dialect;
    const quote = (identifier) => dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
    const reactionsTable = quote(Reaction.tableName || 'reactions');
    const reactionFkColumn = quote('voice_note_id');
    const voiceNoteAlias = quote('VoiceNote'); // Utilise l'alias défini par Sequelize
    const voiceNotePkColumn = quote('id');

    const reactionCountLiteral = Sequelize.literal(
        `(SELECT COUNT(*) FROM ${reactionsTable} WHERE ${reactionsTable}.${reactionFkColumn} = ${voiceNoteAlias}.${voiceNotePkColumn})`
    );

    let orderClause = [];
    if (sortField === 'reactionCount') {
        orderClause = [[Sequelize.literal('reactionCount'), sortOrder]];
        orderClause.push(['created_at', 'DESC']); // Tri secondaire
    } else {
        const dbColumnName = sortBy === 'createdAt' ? 'created_at' : sortBy;
        if (VoiceNote.rawAttributes[dbColumnName]) { orderClause = [[dbColumnName, sortOrder]]; }
        else { orderClause = [['created_at', 'DESC']]; }
    }
     console.log("[getVoiceNotes - Main Feed] Order clause:", orderClause);

    // --- Requête Principale AVEC LES BONS INCLUDES ---
    const { count, rows: voiceNotes } = await VoiceNote.findAndCountAll({
      attributes: {
          include: [ [reactionCountLiteral, 'reactionCount'] ],
      },
      include: [
          { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
          { model: Reaction, as: 'reactions', attributes: ['id', 'user_id', 'emoji'], required: false },
          // ===> INCLUDES POUR LES COMMENTAIRES <===
          {
              model: Comment,
              as: 'comments', // <<< VÉRIFIEZ CET ALIAS DANS VoiceNote MODEL
              attributes: ['id', 'text', 'user_id', 'createdAt'],
              required: false,
              order: [['createdAt', 'ASC']],
              include: [
                  {
                      model: User,
                      as: 'user', // <<< VÉRIFIEZ CET ALIAS DANS Comment MODEL
                      attributes: ['id', 'username', 'avatar']
                  }
              ]
          }
          // ===> FIN INCLUDES COMMENTAIRES <===
      ],
      order: orderClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      distinct: true, // Important pour count avec hasMany includes
      // subQuery: false, // À tester seulement si LIMIT/OFFSET pose problème
    });
     console.log(`[getVoiceNotes - Main Feed] Found ${count.length || count} potential rows, returning ${voiceNotes.length} distinct notes.`);

    // Comptage plus fiable des notes principales
    const totalItems = await VoiceNote.count({ distinct: true, col: 'id' });
     console.log(`[getVoiceNotes - Main Feed] Total distinct notes count: ${totalItems}`);


    res.status(200).json({
      status: 'success',
      results: voiceNotes.length,
      totalVoiceNotes: totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page, 10),
      data: {
        voiceNotes: voiceNotes.map(vn => vn.toJSON()) // Utiliser toJSON()
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

// ===> OPTIONNEL: Si vous avez besoin d'une vraie fonction pour "Mes Notes" (filtrées par user) <===
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
        where: { user_id: userId }, // *** LE FILTRE IMPORTANT ***
        include: [
            // Ajoutez les includes pour réactions/commentaires si nécessaire pour cette vue
            { model: Reaction, as: 'reactions', attributes: ['id', 'user_id', 'emoji'], required: false },
            // { model: Comment, as: 'comments', ... include: [{ model: User, as: 'user' ...}] ... } // Si besoin
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