const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Voice note comments
 */

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data: # Ou application/json si pas d'upload audio direct dans le commentaire
 *           schema:
 *             type: object
 *             properties:
 *               voiceNoteId:
 *                 type: string
 *               text:
 *                 type: string
 *               audio: # Optionnel: dépend si vous permettez les commentaires audio
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Comment created
 *       400:
 *         description: Bad request
 */
router.post('/', authMiddleware, commentController.createComment);

/**
 * @swagger
 * /api/comments/voice-note/{voiceNoteId}:
 *   get:
 *     summary: Get comments for a voice note
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: voiceNoteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid # Préciser le format si c'est un UUID
 *         description: ID of the voice note to get comments for
 *     responses:
 *       200:
 *         description: List of comments
 */
router.get('/voice-note/:voiceNoteId', commentController.getComments);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid # Préciser le format si c'est un UUID
 *         description: ID of the comment to delete
 *     responses:
 *       204:
 *         description: Comment deleted
 *       401:
 *         description: Unauthorized (not the owner or admin)
 *       404:
 *         description: Comment not found
 */
router.delete('/:id', authMiddleware, commentController.deleteComment);

module.exports = router;