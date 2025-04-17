'use strict';

// Importer les modèles et les outils de validation
const { Reaction, VoiceNote, User, Notification, Sequelize } = require('../models'); 
const { validationResult } = require('express-validator');
const Op = Sequelize.Op; 

// Fonction helper pour vérifier l'authentification (gardez votre version)
const ensureAuthenticated = (req) => {
    if (!req.user || !req.user.id) {
        const error = new Error('Authentification requise.');
        error.statusCode = 401;
        throw error;
    }
    return req.user.id;
};

// === Ajouter ou Mettre à jour une Réaction ===
exports.addReaction = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'fail', errors: errors.array() });
    }

    try {
        const userId = ensureAuthenticated(req); // Celui qui réagit (actor)
        const { voiceNoteId, emoji } = req.body;

        // Vérifier VoiceNote et récupérer son propriétaire
        const voiceNote = await VoiceNote.findOne({ where: { id: voiceNoteId } });
        if (!voiceNote) {
            return res.status(404).json({ status: 'fail', message: 'La note vocale spécifiée n\'existe pas.' });
        }
        const ownerId = voiceNote.user_id; // Le propriétaire (recipient)

        // Upsert logique
        let reaction = await Reaction.findOne({
            where: { user_id: userId, voice_note_id: voiceNoteId }
        });
        let statusCode = 200;
        let isNewReaction = false; // Flag pour la notification

        if (reaction) {
            if (reaction.emoji !== emoji) { // Mise à jour de l'emoji
                reaction.emoji = emoji;
                await reaction.save();
                console.log(`[addReaction] Reaction updated for user ${userId} on note ${voiceNoteId}`);
            } else { 
                 console.log(`[addReaction] Reaction already exists with same emoji.`);
            }
        } else { // Création
            reaction = await Reaction.create({
                user_id: userId,
                voice_note_id: voiceNoteId,
                emoji: emoji
            });
            statusCode = 201;
            isNewReaction = true; // Marquer pour notification
            console.log(`[addReaction] New reaction created (ID: ${reaction.id})`);
        }

        // --- AJOUT : Création de la Notification ---
        if (isNewReaction && ownerId !== userId) { // Seulement si nouvelle et pas par le propriétaire
            try {
                await Notification.create({
                    recipientUserId: ownerId,
                    actorUserId: userId,
                    type: 'like', // Ou un type plus spécifique si vous gérez plusieurs emojis
                    voiceNoteId: voiceNote.id,
                    reactionId: reaction.id, // Lier à la réaction créée
                    read: false
                });
                console.log(`[addReaction] Notification 'like' created for user ${ownerId}`);
            } catch (notifError) {
                console.error("[addReaction] Error creating 'like' notification:", notifError.message);
            }
        }

        // Récupérer TOUTES les réactions à jour pour la réponse frontend
        const updatedReactions = await Reaction.findAll({
            where: { voice_note_id: voiceNoteId },
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
            order: [['createdAt', 'ASC']]
        });

        res.status(statusCode).json({
            status: 'success',
            data: { reactions: updatedReactions.map(r => r.toJSON()) } 
        });

    } catch (error) {
        console.error("[Reaction Controller Error - addReaction]:", error);
        if (error.statusCode === 401) { return res.status(401).json({ status: 'fail', message: error.message }); }
        next(error);
    }
};

// === Supprimer une Réaction ===
exports.removeReaction = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { /* ... */ }

    try {
        const userId = ensureAuthenticated(req);
        const { id } = req.params; // ID de la réaction

        const reaction = await Reaction.findOne({ where: { id: id, user_id: userId } });
        if (!reaction) { /* ... */ }

        const voiceNoteId = reaction.voice_note_id;
        await reaction.destroy();
        console.log(`[removeReaction] Reaction ID ${id} deleted by user ${userId}`);

        // Récupérer et renvoyer les réactions restantes
        const remainingReactions = await Reaction.findAll({
             where: { voice_note_id: voiceNoteId },
             include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
             order: [['createdAt', 'ASC']]
         });

        res.status(200).json({
            status: 'success',
            data: { reactions: remainingReactions.map(r => r.toJSON()) }
        });

    } catch (error) {
        console.error("[Reaction Controller Error - removeReaction]:", error);
        next(error);
    }
};

// === Obtenir les réactions pour une VoiceNote spécifique ===
exports.getReactions = async (req, res, next) => {
     
     try {
        const { voiceNoteId } = req.params;
        const voiceNote = await VoiceNote.count({ where: { id: voiceNoteId } });
        if (voiceNote === 0) { return res.status(404).json({ status: 'fail', message: 'Note vocale non trouvée.' }); }

        const reactions = await Reaction.findAll({
            where: { voice_note_id: voiceNoteId },
            include: [ { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] } ],
            order: [['createdAt', 'ASC']]
        });

        // Regroupement (si vous le gardez)
        const reactionsGrouped = reactions.reduce((acc, reaction) => {
            const emoji = reaction.emoji;
            if (!acc[emoji]) { acc[emoji] = []; }
            acc[emoji].push(reaction.user); // Pousse l'objet utilisateur
            return acc;
        }, {});


        res.status(200).json({
            status: 'success',
            // Renvoie les réactions brutes et/ou groupées selon besoin du front
            data: { reactions: reactions.map(r => r.toJSON()), reactionsGrouped: reactionsGrouped }
        });
    } catch (error) {
        console.error("[Reaction Controller Error - getReactions]:", error);
        next(error);
    }
};



