// middleware/socketAuth.js (Nouveau Fichier)
'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models'); 

// Middleware d'authentification pour les connexions Socket.IO
const socketAuthMiddleware = async (socket, next) => {
    // 1. Récupérer le token depuis socket.handshake.auth
    const token = socket.handshake.auth?.token;

    if (!token) {
        console.error('[Socket Auth] Erreur: Token non fourni.');
        // Utiliser next avec une erreur pour refuser la connexion
        return next(new Error('Authentication error: Token not provided'));
    }

    try {
        // 2. Vérifier le token JWT
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("! JWT_SECRET non défini !");
            return next(new Error("Authentication configuration error."));
        }
        const decoded = jwt.verify(token, secret);

        // 3. Valider le payload et l'ID
        if (!decoded.user || !decoded.user.id) {
            console.error('[Socket Auth] Erreur: Payload JWT invalide ou ID manquant.');
            return next(new Error('Authentication error: Invalid token payload'));
        }
        const userId = decoded.user.id;

        // 4. Vérifier l'utilisateur en BDD (existence et activité) - Étape importante pour Socket.IO
        const currentUser = await User.findByPk(userId);
        if (!currentUser) {
            console.warn(`[Socket Auth] Utilisateur (ID: ${userId}) du token non trouvé en BDD.`);
            return next(new Error('Authentication error: User not found'));
        }
        // Assurez-vous que 'isActive' existe sur votre modèle User
        if (currentUser.isActive === false) {
             console.warn(`[Socket Auth] Utilisateur (ID: ${userId}) est inactif.`);
             return next(new Error('Authentication error: User account is deactivated'));
        }

        // 5. Attacher les infos utilisateur utiles au socket
        socket.user = {
            id: currentUser.id,
            username: currentUser.username,
            isAdmin: currentUser.isAdmin
            // Ajoutez d'autres champs si nécessaire
        };

        console.log(`[Socket Auth] Utilisateur ${socket.user.id} authentifié pour Socket ID ${socket.id}`);

        // 6. Authentification réussie
        next();

    } catch (error) {
        // Gérer les erreurs JWT spécifiques
        if (error instanceof jwt.TokenExpiredError) {
            console.error('[Socket Auth] Erreur: Token expiré.');
            return next(new Error('Authentication error: Token expired'));
        }
        if (error instanceof jwt.JsonWebTokenError) {
            console.error('[Socket Auth] Erreur: Token invalide -', error.message);
            return next(new Error('Authentication error: Invalid token'));
        }
        // Gérer les autres erreurs
        console.error('[Socket Auth] Erreur inattendue:', error);
        return next(new Error('Authentication error: Server error'));
    }
};

// Exportation de la fonction 
module.exports = socketAuthMiddleware; 