// routes/notificationRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const protect = require('../middleware/auth'); // Importe directement la fonction exportée

// ===> LOGS DE DÉBOGAGE <===
console.log('Contenu importé de notificationController:', notificationController);
console.log('Fonction protect importée:', typeof protect, protect); // Affiche le type et la fonction elle-même si trouvée
// ===> FIN LOGS <===


// ===> Appliquer le middleware 'protect' ...
if (typeof protect !== 'function') { // Vérification explicite
    console.error("ERREUR: Le middleware 'protect' n'est pas une fonction ! Vérifiez l'importation depuis '../middleware/auth'.");
    // Vous pourriez choisir de lancer une erreur ici ou d'arrêter le processus
    // throw new Error("Middleware 'protect' manquant ou mal importé.");
} else {
    router.use(protect);
}


// --- Définition des Routes ---
if (typeof notificationController.getNotifications !== 'function') {
     console.error("ERREUR: notificationController.getNotifications n'est pas une fonction ! Vérifiez l'exportation.");
} else {
    router.get('/', notificationController.getNotifications);
}

if (typeof notificationController.markAllAsRead !== 'function') {
     console.error("ERREUR: notificationController.markAllAsRead n'est pas une fonction ! Vérifiez l'exportation.");
} else {
    router.post('/mark-all-read', notificationController.markAllAsRead);
}

if (typeof notificationController.markOneAsRead !== 'function') {
     console.error("ERREUR: notificationController.markOneAsRead n'est pas une fonction ! Vérifiez l'exportation.");
} else {
    router.patch('/:id/read', notificationController.markOneAsRead);
}


module.exports = router;