'use strict';

const db = require('../models');
const { User, Conversation, Message, Sequelize } = db;
const sequelize = db.sequelize; // Instance Sequelize
const Op = Sequelize.Op;
const { literal } = require('sequelize');




// --- Créer une nouvelle conversation ---
exports.createConversation = async (req, res, next) => {
    const { participantIds, name } = req.body;
    const creatorId = req.user.id;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ status: 'fail', message: 'participantIds (tableau non vide) est requis.' });
    }

    const allParticipantIds = [...new Set([creatorId, ...participantIds])]; // Assure l'unicité

    if (allParticipantIds.length < 2) {
        return res.status(400).json({ status: 'fail', message: 'Une conversation nécessite au moins deux participants uniques.' });
    }

    const isGroup = allParticipantIds.length > 2;
    const conversationName = isGroup ? (name || `Groupe (${allParticipantIds.length})`) : null;

    let transaction;
    try {
        transaction = await sequelize.transaction();

        // === NOUVELLE APPROCHE pour trouver la conversation 1-1 existante ===
        if (!isGroup && allParticipantIds.length === 2) {
            const [user1Id, user2Id] = allParticipantIds; // Les deux IDs uniques

            // Trouver les conversations 1-1 de l'utilisateur 1
            const user1Conversations = await Conversation.findAll({
                attributes: ['id'], // On a juste besoin des IDs
                where: { is_group: false },
                include: [{
                    model: User,
                    as: 'participants',
                    attributes: [], // Pas besoin des attributs user
                    where: { id: user1Id }, // Doit inclure l'utilisateur 1
                    required: true, // Force INNER JOIN
                    through: { attributes: [] }
                }],
                transaction // Important: Faire partie de la transaction
            });
            const user1ConvIds = user1Conversations.map(conv => conv.id);

            let existingConversation = null;
            // Si l'utilisateur 1 a des conversations 1-1, chercher parmi elles celle qui inclut l'utilisateur 2
            if (user1ConvIds.length > 0) {
                existingConversation = await Conversation.findOne({
                     attributes: ['id'], // On a juste besoin de l'ID
                     where: {
                         id: { [Op.in]: user1ConvIds }, // Doit être une des conversations de l'utilisateur 1
                         is_group: false // Redondant mais sûr
                     },
                     include: [{
                         model: User,
                         as: 'participants',
                         attributes: [], // Pas besoin des attributs user
                         where: { id: user2Id }, // Doit inclure l'utilisateur 2
                         required: true, // Force INNER JOIN
                         through: { attributes: [] }
                     }],
                     
                     transaction // Important: Faire partie de la transaction
                 });

             }

            if (existingConversation) {
                console.log(`Conversation 1-1 existante trouvée par approche alternative: ${existingConversation.id}`);
                await transaction.commit(); // Commit car on a juste lu

                // Recharger la conversation complète pour la réponse
                const fullExistingConv = await Conversation.findByPk(existingConversation.id, {
                    include: [{
                        model: User,
                        as: 'participants',
                        attributes: ['id', 'username', 'avatar', 'fullName']
                    }]
                });

                return res.status(200).json({
                    status: 'success',
                    message: 'Conversation existante récupérée.',
                    data: { conversation: fullExistingConv }
                });
            }
            // Si on arrive ici, aucune conversation 1-1 exacte n'a été trouvée, on continue DANS la transaction
        }


        // --- Le reste de la logique de création (inchangée) ---
        // ... (vérification existance users, create conv, set participants, commit, reload, response) ...
        const existingUsers = await User.count({
            where: { id: { [Op.in]: allParticipantIds } },
            transaction
        });

        if (existingUsers !== allParticipantIds.length) {
            await transaction.rollback();
            return res.status(404).json({ status: 'fail', message: 'Un ou plusieurs participants n\'existent pas.' });
        }

        const newConversation = await Conversation.create({
            name: conversationName,
            is_group: isGroup,
        }, { transaction });

        await newConversation.setParticipants(allParticipantIds, { transaction });

        await transaction.commit();

        const conversationWithParticipants = await Conversation.findByPk(newConversation.id, {
            include: [{
                model: User,
                as: 'participants',
                attributes: ['id', 'username', 'avatar', 'fullName']
            }]
        });

        res.status(201).json({
            status: 'success',
            message: 'Conversation créée avec succès.',
            data: { conversation: conversationWithParticipants }
        });


    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error creating conversation:', error);
        if (error.original) {
            console.error('Original SQL Error:', error.original);
        }
        next(error);
    }
};

// Assurez-vous d'importer Op et literal de sequelize

exports.getMyConversations = async (req, res, next) => {
    const userId = req.user.id;
    const { page = 1, limit = 15 } = req.query;
    const offset = (page - 1) * limit;

    console.log(`[getMyConversations] Fetching for User ID: ${userId}, Page: ${page}, Limit: ${limit}`); // Log

    try {
        // Pré-échapper l'userId pour l'utiliser dans literal (bonne pratique même si vient de req.user)
        const escapedUserId = sequelize.escape(userId);

        const { count, rows: conversations } = await Conversation.findAndCountAll({
            // === NOUVEAU FILTRE ===
            // Filtrer les Conversations dont l'ID se trouve dans la table de jonction
            // pour l'utilisateur spécifié.
            where: {
                id: { // Filtrer sur Conversation.id
                    [Op.in]: literal(`(
                        SELECT conversation_id
                        FROM conversation_participants
                        WHERE user_id = ${escapedUserId}
                    )`)
                }
            },
            // === FIN NOUVEAU FILTRE ===
            include: [
                {
                    // L'include sert maintenant UNIQUEMENT à récupérer les données des participants
                    model: User,
                    as: 'participants',
                    attributes: ['id', 'username', 'fullName', 'avatar'],
                    // PAS de 'where' ici, le filtrage est fait au-dessus
                    through: { attributes: [] }
                },
                {
                    // Inclure le dernier message (inchangé)
                    model: Message,
                    as: 'lastMessage',
                    required: false,
                    include: [{
                        model: User,
                        as: 'sender',
                        attributes: ['id', 'username', 'avatar']
                    }]
                }
            ],
            order: [
                 ['updatedAt', 'DESC']
            ],
            limit: parseInt(limit, 10),
            offset: offset,
            distinct: true, // Toujours important pour le count avec N:M
            // subQuery: false // Laisser commenté pour l'instant
        });

        console.log(`[getMyConversations] Found Count: ${count}, Rows on page: ${conversations.length}`);

        const totalPages = Math.ceil(count / limit);

        res.status(200).json({
            status: 'success',
            results: conversations.length,
            totalConversations: count,
            totalPages: totalPages,
            currentPage: parseInt(page, 10),
            data: { conversations }
        });

    } catch (error) {
        console.error('Error fetching conversations:', error);
        if (error.original) {
             console.error('Original SQL Error:', error.original);
             console.error('Generated SQL:', error.sql); // Toujours utile
        }
        next(error);
    }
};

// --- Obtenir les messages d'une conversation spécifique ---
exports.getConversationMessages = async (req, res, next) => {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { page = 1, limit = 30 } = req.query; 
    const offset = (page - 1) * limit;

    try {
        // 1. Vérifier si l'utilisateur a accès à cette conversation
        const conversation = await Conversation.findByPk(conversationId, {
             include: [{ model: User, as: 'participants', attributes: ['id'], where: { id: userId } }]
        });

        if (!conversation) {
            return res.status(403).json({ status: 'fail', message: 'Accès non autorisé ou conversation inexistante.' });
        }

        // 2. Récupère les messages de la conversation avec pagination
        const { count, rows: messages } = await Message.findAndCountAll({
            where: { conversation_id: conversationId },
            include: [{
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'avatar'] // Infos de l'expéditeur
            }],
            order: [['createdAt', 'DESC']], 
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });

        const totalPages = Math.ceil(count / limit);

        res.status(200).json({
            status: 'success',
            results: messages.length,
            totalMessages: count,
            totalPages: totalPages,
            currentPage: parseInt(page, 10),
            // Inverser pour affichage chronologique sur le client si nécessaire
            data: { messages: messages.reverse() }
        });

    } catch (error) {
        console.error(`Error fetching messages for conversation ${conversationId}:`, error);
        next(error);
    }
};


// --- (Optionnel) Trouver des utilisateurs pour démarrer une conversation ---
exports.findUsersForConversation = async (req, res, next) => {
    const searchTerm = req.query.search || '';
    const currentUserId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!searchTerm.trim()) {
        return res.status(400).json({ status: 'fail', message: 'Terme de recherche requis.' });
    }

    try {
        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { username: { [Op.like]: `%${searchTerm}%` } },
                    { email: { [Op.like]: `%${searchTerm}%` } },
                    { fullName: { [Op.like]: `%${searchTerm}%` } }
                ],
                id: { [Op.ne]: currentUserId } // Exclure l'utilisateur courant
            },
            attributes: ['id', 'username', 'avatar', 'fullName'],
            limit: limit
        });

        res.status(200).json({ status: 'success', data: { users } });

    } catch (error) {
        console.error('Error finding users:', error);
        console.error('Sequelize Error Details:', error.original || error);
        next(error); 
    }
};