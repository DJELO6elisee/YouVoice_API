const express = require('express');
const router = express.Router();
const reactionController = require('../controllers/reactionController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Reactions
 *   description: Voice note reactions
 */

/**
 * @swagger
 * /api/reactions:
 *   post:
 *     summary: Add or update a reaction to a voice note
 *     description: Creates a new reaction or potentially updates an existing one if the business logic allows (e.g., changing emoji). Requires authentication.
 *     tags: [Reactions]
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
 *               - emoji
 *             properties:
 *               voiceNoteId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the voice note to react to.
 *               emoji:
 *                 type: string
 *                 description: The emoji used for the reaction (e.g., "❤", "😂").
 *                 example: "🔥"
 *     responses:
 *       201:
 *         description: Reaction added or updated successfully.
 *       400:
 *         description: Bad request (e.g., missing fields, invalid emoji, reacting to own note if disallowed).
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       404:
 *         description: Voice note not found.
 *       409:
 *         description: Conflict (e.g., user already reacted with this emoji if only one reaction per type is allowed).
 */
router.post('/', authMiddleware, reactionController.addReaction);

/**
 * @swagger
 * /api/reactions/{id}:
 *   delete:
 *     summary: Remove a reaction
 *     description: Deletes a specific reaction identified by its ID. Requires authentication and user must be the owner of the reaction.
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the reaction to remove.
 *     responses:
 *       204:
 *         description: Reaction removed successfully (No Content).
 *       401:
 *         description: Unauthorized (token missing, invalid, or user is not the owner).
 *       404:
 *         description: Reaction not found.
 */
router.delete('/:id', authMiddleware, reactionController.removeReaction);

/**
 * @swagger
 * /api/reactions/voice-note/{voiceNoteId}:
 *   get:
 *     summary: Get all reactions for a specific voice note
 *     description: Retrieves a list of reactions associated with a given voice note ID.
 *     tags: [Reactions]
 *     parameters:
 *       - in: path
 *         name: voiceNoteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the voice note to get reactions for.
 *     responses:
 *       200:
 *         description: A list of reactions for the voice note.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 # Définir ici le schéma d'une réaction (ex: id, userId, emoji, createdAt)
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   user_id:
 *                     type: string
 *                     format: uuid
 *                   emoji:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *       404:
 *         description: Voice note not found.
 */
router.get('/voice-note/:voiceNoteId', reactionController.getReactions);

module.exports = router;