'use strict';

// Importer les modèles nécessaires
const { Notification, User, VoiceNote, Sequelize } = require('../models');
const Op = Sequelize.Op; // Opérateur Sequelize pour les requêtes complexes si besoin

// === Obtenir les Notifications pour l'Utilisateur Connecté ===
exports.getNotifications = async (req, res, next) => {
    console.log("[getNotifications] Fetching notifications for user:", req.user?.id);
    try {
        const userId = req.user?.id; // Récupéré via middleware 'protect'
        if (!userId) {
            return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });
        }

        // Options de pagination et filtrage depuis les query params
        const limit = parseInt(req.query.limit, 10) || 15; // Limite par défaut
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;
        const statusFilter = req.query.status; // ex: 'non lu'

        // Construire la clause WHERE
        const whereClause = {
            recipientUserId: userId // Uniquement les notifications pour cet utilisateur
        };
        if (statusFilter === 'unread') {
            whereClause.read = false; // Filtrer seulement les non lues
        }

        // Requête pour récupérer les notifications et compter le total
        const { count, rows: notifications } = await Notification.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'actor', // Utilisateur qui a déclenché la notification
                    attributes: ['id', 'username', 'avatar'], // Champs nécessaires
                    required: false // Permet les notifications système (actorUserId peut être NULL)
                },
                {
                    model: VoiceNote, 
                    as: 'voiceNote',
                    attributes: ['id', 'description'], 
                    required: false 
                }
                
            ],
            order: [['createdAt', 'DESC']], // Les plus récentes en premier
            limit: limit,
            offset: offset
        });

        console.log(`[getNotifications] Found ${count} total matching notifications, returning ${notifications.length} for page ${page}`);

        res.status(200).json({
            status: 'success',
            results: notifications.length,
            totalNotifications: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            data: {
                notifications: notifications.map(n => n.toJSON()) 
            }
        });
    } catch (error) {
        console.error("[getNotifications] Error:", error);
        next(error); 
    }
};

// === Marquer Toutes les Notifications comme Lues ===
exports.markAllAsRead = async (req, res, next) => {
    console.log("[markAllAsRead] Request for user:", req.user?.id);
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });
        }

        const [affectedCount] = await Notification.update(
            { read: true }, 
            {
                where: {
                    recipientUserId: userId, 
                    read: false 
                },
            }
        );

        console.log(`[markAllAsRead] Marked ${affectedCount} notifications as read for user ${userId}`);

        // Répondre avec succès, indiquant combien ont été marquées (peut être 0)
        res.status(200).json({
             status: 'success',
             message: `${affectedCount} notification(s) marquée(s) comme lue(s).`
             
        });

    } catch (error) {
        console.error("[markAllAsRead] Error:", error);
        next(error);
    }
};

// === Marquer Une Notification Spécifique comme Lue (Optionnel) ===
exports.markOneAsRead = async (req, res, next) => {
    const notificationId = req.params.id; // Récupère l'ID depuis l'URL (:id)
    const userId = req.user?.id;
    console.log(`[markOneAsRead] Request for notification ${notificationId} by user ${userId}`);

    try {
        if (!userId) {
            return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });
        }

        // Trouver la notification spécifique pour cet utilisateur
        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                recipientUserId: userId // Sécurité: Vérifie que la notification appartient bien à l'utilisateur
            }
        });

        // Si non trouvée ou n'appartient pas à l'utilisateur
        if (!notification) {
            return res.status(404).json({ status: 'fail', message: 'Notification non trouvée ou accès refusé.' });
        }

        // Si elle n'est pas déjà lue, la marquer comme lue
        if (!notification.read) {
            notification.read = true;
            await notification.save(); // Sauvegarder la modification
            console.log(`[markOneAsRead] Marked notification ${notificationId} as read.`);
            res.status(200).json({ status: 'success', message: 'Notification marquée comme lue.', data: { notification: notification.toJSON() } }); // Renvoyer la notif mise à jour
        } else {
            // Si déjà lue, renvoyer succès sans rien faire
            console.log(`[markOneAsRead] Notification ${notificationId} was already read.`);
            res.status(200).json({ status: 'success', message: 'Notification déjà lue.', data: { notification: notification.toJSON() } });
        }

    } catch (error) {
        console.error(`[markOneAsRead Error ID ${notificationId}]:`, error);
        next(error);
    }
};

