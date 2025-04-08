const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Shares
 *   description: Tracking voice note sharing actions
 */

/**
 * @swagger
 * /api/shares:
 *   post:
 *     summary: Record a voice note share action
 *     description: Logs an instance of a user sharing a specific voice note to a platform or another user. Requires authentication.
 *     tags: [Shares]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voiceNoteId
 *               - sharedTo # Remplacé 'platform' par 'sharedTo' pour correspondre au modèle
 *             properties:
 *               voiceNoteId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the voice note being shared.
 *               sharedTo:
 *                 type: string
 *                 description: Describes where or to whom the note was shared (e.g., "facebook", "twitter", "whatsapp", a user ID, "link_copied", "other").
 *                 example: "twitter"
 *     responses:
 *       201:
 *         description: Share action recorded successfully.
 *       400:
 *         description: Bad request (e.g., missing fields, invalid voiceNoteId).
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       404:
 *         description: Voice note not found.
 */
router.post('/', authMiddleware, shareController.shareVoiceNote);

/**
 * @swagger
 * /api/shares/voice-note/{voiceNoteId}:
 *   get:
 *     summary: Get share records for a voice note
 *     description: Retrieves a list of share actions recorded for a specific voice note. Could be restricted (e.g., admin only or aggregated counts only).
 *     tags: [Shares]
 *     # security:
 *     #   - bearerAuth: [] # Potentiellement restreindre l'accès (ex: admin ou propriétaire de la note)
 *     parameters:
 *       - in: path
 *         name: voiceNoteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the voice note to get share records for.
 *       - in: query # Ajouter pagination
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: A list of share records (or aggregated data).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 # Définir le schéma d'un enregistrement de partage
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   user_id:
 *                     type: string
 *                   voice_note_id:
 *                     type: string
 *                   shared_to:
 *                     type: string
 *                   created_at:
 *                     type: string
 *       404:
 *         description: Voice note not found.
 *       # Potentiellement 401/403 si l'accès est restreint
 */
router.get('/voice-note/:voiceNoteId', shareController.getShares); // Ajouter authMiddleware si nécessaire

module.exports = router;