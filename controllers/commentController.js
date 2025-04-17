// controllers/commentController.js
'use strict';

// Importer les modèles nécessaires
const { Comment, VoiceNote, User, Notification, Sequelize } = require('../models'); // <-- AJOUT Notification et Sequelize
const Op = Sequelize.Op; // <-- AJOUT Op

// === Créer un nouveau commentaire ===
exports.createComment = async (req, res, next) => {
  try {
    const { voiceNoteId, text } = req.body;
    const userId = req.user?.id; // L'utilisateur qui commente (actor)

    // --- VALIDATIONS IMPORTANTES ---
    if (!userId) { return res.status(401).json({ status: 'fail', message: 'Authentification requise pour commenter.' }); }
    if (!voiceNoteId) { return res.status(400).json({ status: 'fail', message: 'L\'ID de la note vocale est requis.' }); }
    if (!text || text.trim() === '') { return res.status(400).json({ status: 'fail', message: 'Le texte du commentaire ne peut pas être vide.' }); }

    const voiceNote = await VoiceNote.findByPk(voiceNoteId);
    if (!voiceNote) { return res.status(404).json({ status: 'fail', message: 'La note vocale spécifiée n\'existe pas.' }); }

    const ownerId = voiceNote.user_id; // Propriétaire de la note (recipient)

    // Créer le commentaire
    console.log(`[Create Comment] Attempting create: user_id=${userId}, voice_note_id=${voiceNoteId}`);
    const comment = await Comment.create({
      user_id: userId,
      voice_note_id: voiceNoteId,
      text: text,
    });
    console.log(`[Create Comment] Comment created with ID: ${comment.id}`);

    // --- AJOUT : Création de la Notification ---
    if (ownerId !== userId) { // Ne pas notifier si on commente sa propre note
        try {
            await Notification.create({
                recipientUserId: ownerId,    // Le propriétaire reçoit la notif
                actorUserId: userId,         // Celui qui a commenté
                type: 'comment',
                voiceNoteId: voiceNote.id,   // Lien vers la note
                commentId: comment.id,       // Lien vers le commentaire créé
                read: false
            });
             console.log(`[Create Comment] Notification 'comment' created for user ${ownerId}`);
        } catch (notifError) {
            console.error("[Create Comment] Error creating 'comment' notification:", notifError.message);
        }
    }
    // --- FIN AJOUT NOTIFICATION ---

    // Récupère le commentaire créé avec les informations utilisateur pour la réponse
    const commentWithUser = await Comment.findByPk(comment.id, {
        include: [{
            model: User,
            as: 'user', // Vérifier cet alias dans models/comment.js
            attributes: ['id', 'username', 'avatar']
        }]
    });

    if (!commentWithUser) {
        console.error(`[Create Comment] Failed recovery for comment ${comment.id}`);
        return res.status(201).json({
            status: 'success', message: "Commentaire créé mais détails user indisponibles.",
            data: { comment: comment.toJSON() } // Renvoyer au moins le commentaire brut
          });
    }

    res.status(201).json({
      status: 'success',
      data: { comment: commentWithUser.toJSON() }
    });
  } catch (error) {
    console.error("[Create Comment] Error caught:", error);
    next(error);
  }
};

// === Obtenir les commentaires pour une VoiceNote spécifique ===
exports.getComments = async (req, res, next) => {
    
    try {
        const { voiceNoteId } = req.params;
        const voiceNoteExists = await VoiceNote.count({ where: { id: voiceNoteId } });
        if (voiceNoteExists === 0) { return res.status(404).json({ status: 'fail', message: 'Note vocale non trouvée.' }); }

        const comments = await Comment.findAll({
          where: { voice_note_id: voiceNoteId }, 
          include: [ { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] } ],
          order: [['createdAt', 'ASC']]
        });
        res.status(200).json({
          status: 'success', results: comments.length,
          data: { comments: comments.map(c => c.toJSON()) }
        });
      } catch (error) {
        console.error(`[Get Comments] Error for voiceNoteId ${req.params.voiceNoteId}:`, error);
        next(error);
      }
};

// === Supprimer un commentaire ===
exports.deleteComment = async (req, res, next) => {
    
     try {
        const { id } = req.params; 
        const userId = req.user?.id;
        if (!userId) { return res.status(401).json({ status: 'fail', message: 'Auth requise.' }); }

        const comment = await Comment.findOne({ where: { id: id, user_id: userId } }); 
        if (!comment) { return res.status(404).json({ status: 'fail', message: 'Commentaire non trouvé ou action non autorisée.' }); }

        await comment.destroy();
        console.log(`[Delete Comment] Comment ${id} deleted by User ${userId}.`);
        res.status(204).send();
      } catch (error) {
        console.error(`[Delete Comment] Error for ID ${req.params.id}:`, error);
        next(error);
      }
};