// controllers/shareController.js
'use strict';

// Importer les modèles nécessaires
const { Share, VoiceNote, User, Notification, Sequelize } = require('../models'); 
const Op = Sequelize.Op; 

// === Enregistrer un Partage de Note Vocale ===
exports.shareVoiceNote = async (req, res, next) => {
  console.log('[CreateShare] Received request body:', req.body);
  try {
    const { voiceNoteId, sharedTo } = req.body;
    const userId = req.user?.id; // L'utilisateur qui partage (actor)

    // --- Validation des entrées ---
    if (!userId) { return res.status(401).json({ status: 'fail', message: 'Authentification requise.' }); }
    if (!voiceNoteId || !sharedTo) { return res.status(400).json({ status: 'fail', message: 'Les champs voiceNoteId et sharedTo sont requis.' }); }

    // Vérifier si la VoiceNote existe et récupérer son propriétaire
    const voiceNote = await VoiceNote.findByPk(voiceNoteId);
    if (!voiceNote) { return res.status(404).json({ status: 'fail', message: 'La note vocale spécifiée n\'existe pas.' }); }

    const ownerId = voiceNote.user_id; // Propriétaire de la note (recipient)

    // Créer l'enregistrement du partage
    const newShare = await Share.create({
      user_id: userId,
      voice_note_id: voiceNoteId,
      shared_to: sharedTo
    });
    console.log(`[CreateShare] Share record created with ID: ${newShare.id}`);

    try {
        await voiceNote.increment('shareCount', { by: 1 });
        console.log(`[CreateShare] Incremented shareCount for VoiceNote ${voiceNoteId}`);
    } catch(incrementError) {
        console.error(`[CreateShare] Failed to increment shareCount (colonne existe?):`, incrementError.message);
    }

    // --- AJOUT : Création de la Notification ---
    if (ownerId !== userId) { // Ne pas notifier si on partage sa propre note
        try {
            await Notification.create({
                recipientUserId: ownerId,    // Le propriétaire reçoit la notif
                actorUserId: userId,         // Celui qui a partagé
                type: 'share',
                voiceNoteId: voiceNote.id,   // Lien vers la note
                shareId: newShare.id,        // Lien vers l'enregistrement de partage
                read: false
            });
            console.log(`[CreateShare] Notification 'share' created for user ${ownerId}`);
        } catch (notifError) {
            console.error("[CreateShare] Error creating 'share' notification:", notifError.message);
        }
    }

    // Recharger l'objet share pour inclure l'utilisateur (pour la réponse)
    const shareWithUser = await Share.findByPk(newShare.id, {
        include: [{
            model: User,
            as: 'user', // Vérifier l'alias dans Share.associate
            attributes: ['id', 'username', 'avatar']
        }]
    });

     console.log(`[CreateShare] Share recorded: User ${userId} shared Note ${voiceNoteId} to ${sharedTo}`);

    res.status(201).json({
        status: 'success',
        message: 'Partage enregistré.',
        data: { share: shareWithUser ? shareWithUser.toJSON() : newShare.toJSON() }
    });

  } catch (error) {
     console.error("[CreateShare] Error:", error);
     next(error);
  }
};

// === Obtenir les Partages pour une Note Vocale ===
exports.getShares = async (req, res, next) => {
     try {
        const { voiceNoteId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const voiceNoteExists = await VoiceNote.findByPk(voiceNoteId, { attributes: ['id'] });
        if (!voiceNoteExists) { return res.status(404).json({ status: 'fail', message: 'Note vocale non trouvée.' }); }
        const offset = (page - 1) * limit;
        const { count, rows: shares } = await Share.findAndCountAll({
          where: { voice_note_id: voiceNoteId },
          include: [ { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] } ],
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10)
        });
        res.status(200).json({
            status: 'success', results: shares.length, totalShares: count,
            totalPages: Math.ceil(count / limit), currentPage: parseInt(page, 10),
            data: { shares: shares.map(s => s.toJSON()) }
        });
      } catch (error) {
        console.error(`[GetShares Error for Note ${req.params.voiceNoteId}]:`, error);
        next(error);
      }
};