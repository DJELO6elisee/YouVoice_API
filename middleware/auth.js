const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Ajustez le chemin si nécessaire

module.exports = function(req, res, next) {
    // 1. Obtenir le token de l'en-tête Authorization
    const authHeader = req.header('Authorization');

    // Vérifier si l'en-tête existe et s'il est au format Bearer
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided or token format is invalid.' });
    }

    // Extraire le token (enlever "Bearer ")
    const token = authHeader.split(' ')[1];

    // Vérifier si le token existe après split
    if (!token) {
         return res.status(401).json({ success: false, message: 'Malformed token.' });
    }

    try {
        // 2. Vérifier le token en utilisant la clé secrète
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET is not defined in environment variables!");
            // Ne pas donner trop d'infos au client en cas d'erreur serveur
            return res.status(500).json({ success: false, message: "Authentication configuration error."});
        }

        // décoder le payload { user: { id: '...' } }
        const decoded = jwt.verify(token, secret);

        // 3. Attacher l'utilisateur (ou au moins son ID) à l'objet request
        // 'decoded.user' correspond au payload défini lors de la création du token dans la fonction login
        if (!decoded.user || !decoded.user.id) {
             console.error('Invalid token payload structure:', decoded);
             return res.status(401).json({ success: false, message: 'Invalid token payload.' });
        }

        req.user = decoded.user; // Maintenant req.user = { id: '...' }

        next(); // Passer au prochain middleware ou au contrôleur

    } catch (error) {
        console.error('Token Verification Error:', error.name, error.message);
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ success: false, message: 'Token expired.' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
             return res.status(401).json({ success: false, message: 'Invalid token.' });
        }
        // Autre erreur (potentiellement serveur)
        res.status(500).json({ success: false, message: 'Failed to authenticate token.' });
    }
};