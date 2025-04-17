// routes/conversationRoutes.js (Version correcte utilisant l'original auth.js)
'use strict';

const express = require('express');
const conversationController = require('../controllers/conversationController');
// Importer le middleware original (export par défaut)
const authMiddleware = require('../middleware/auth'); // <-- Pointe vers votre auth.js original

const router = express.Router();

// Appliquer le middleware original à toutes les routes ci-dessous
router.use(authMiddleware); // <-- Fonctionne car auth.js exporte une fonction par défaut

// Créer une nouvelle conversation
router.post('/', conversationController.createConversation);

// Obtenir les conversations de l'utilisateur connecté
router.get('/', conversationController.getMyConversations);

// Obtenir les messages d'une conversation spécifique
router.get('/:conversationId/messages', conversationController.getConversationMessages);

// (Optionnel) Route pour rechercher des utilisateurs
router.get('/find-users', conversationController.findUsersForConversation);

module.exports = router;