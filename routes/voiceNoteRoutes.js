// routes/voiceNoteRoutes.js

const express = require('express');
const router = express.Router();
const voiceNoteController = require('../controllers/voiceNoteController');
// Assure-toi que le chemin vers ton middleware d'authentification est correct
const authMiddleware = require('../middleware/auth');

// --- AJOUT: Console log pour vérifier l'import ---
console.log('Contenu importé de voiceNoteController:', typeof voiceNoteController, Object.keys(voiceNoteController));
if (typeof voiceNoteController.getVoiceNotes !== 'function') {
    console.error("ERREUR: voiceNoteController.getVoiceNotes N'EST PAS une fonction!");
}
if (typeof voiceNoteController.getVoiceNoteById !== 'function') {
    console.error("ERREUR: voiceNoteController.getVoiceNoteById N'EST PAS une fonction!");
}
// --- FIN AJOUT ---


/**
 * @swagger
 * tags:
 *   name: Voice Notes
 *   description: Managing and retrieving voice notes
 */

// === CREATE ===
/**
 * @swagger
 * /api/voice-notes:
 *   post:
 *     summary: Create a new voice note
 *     description: Uploads an audio file and associated metadata to create a new voice note. Requires authentication.
 *     tags: [Voice Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - audio
 *               - duration
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: The audio file (e.g., webm, ogg, mp3). Max size/types determined by server config.
 *               duration:
 *                 type: integer
 *                 description: Duration of the voice note in seconds (e.g., max 300). Sent as a form field.
 *                 example: 45
 *               description:
 *                 type: string
 *                 description: Optional text description for the voice note. Sent as a form field.
 *     responses:
 *       201:
 *         description: Voice note created successfully. Includes the created voice note data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string }
 *                 data: { type: object, properties: { voiceNote: { $ref: '#/components/schemas/VoiceNoteDetail' } } }
 *       400:
 *         description: Bad request (e.g., missing file, missing/invalid duration, invalid file type, file too large).
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       500:
 *         description: Internal server error during file processing or database operation.
 */
router.post('/', authMiddleware, voiceNoteController.createVoiceNote);

// === READ (Feed/Public) ===
/**
 * @swagger
 * /api/voice-notes:
 *   get:
 *     summary: Get a list of (public) voice notes (Feed)
 *     description: Retrieves a paginated list of voice notes, typically for a public feed. Includes user details and reaction counts.
 *     tags: [Voice Notes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of items per page.
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, reactionCount], default: createdAt }
 *         description: Field to sort by.
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [ASC, DESC], default: DESC }
 *         description: Sort order.
 *     responses:
 *       200:
 *         description: A paginated list of voice notes.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                  status: { type: string, example: success }
 *                  results: { type: integer }
 *                  totalVoiceNotes: { type: integer }
 *                  totalPages: { type: integer }
 *                  currentPage: { type: integer }
 *                  data:
 *                    type: object
 *                    properties:
 *                       voiceNotes:
 *                         type: array
 *                         items: { $ref: '#/components/schemas/VoiceNoteFeedItem' } # Référence au schéma spécifique
 *       400:
 *         description: Bad request (e.g., invalid query parameters).
 *       500:
 *         description: Internal server error.
 */
router.get('/', /* authMiddleware, */ voiceNoteController.getVoiceNotes); // Ligne 148 (environ) - Erreur ici


// === READ (My Notes - NOUVELLE ROUTE) ===
/**
 * @swagger
 * /api/voice-notes/my-notes:
 *   get:
 *     summary: Get voice notes for the authenticated user
 *     description: Retrieves a paginated list of voice notes created *only* by the currently logged-in user. Requires authentication.
 *     tags: [Voice Notes]
 *     security:
 *       - bearerAuth: [] # Authentification requise
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of items per page.
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, duration], default: createdAt }
 *         description: Field to sort by.
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [ASC, DESC], default: DESC }
 *         description: Sort order.
 *     responses:
 *       200:
 *         description: A paginated list of the user's own voice notes.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: # Schéma similaire à GET / mais sans user dans chaque note
 *                  status: { type: string, example: success }
 *                  results: { type: integer }
 *                  totalVoiceNotes: { type: integer }
 *                  totalPages: { type: integer }
 *                  currentPage: { type: integer }
 *                  data:
 *                    type: object
 *                    properties:
 *                       voiceNotes:
 *                         type: array
 *                         items: { $ref: '#/components/schemas/MyVoiceNoteItem' } # Schéma spécifique
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       500:
 *         description: Internal server error.
 */
router.get('/my-notes', authMiddleware, voiceNoteController.getMyVoiceNotes); // Ligne 199 (environ)


// === READ (Specific Note by ID) ===
/**
 * @swagger
 * /api/voice-notes/{id}:
 *   get:
 *     summary: Get a specific voice note by its ID
 *     description: Retrieves the details of a single voice note, including user, reactions, and potentially comments.
 *     tags: [Voice Notes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The unique ID of the voice note to retrieve.
 *     responses:
 *       200:
 *         description: Voice note data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                    type: object
 *                    properties:
 *                      voiceNote: { $ref: '#/components/schemas/VoiceNoteDetail' } # Schéma détaillé
 *       401: { description: Unauthorized (if auth required and fails) }
 *       403: { description: Forbidden (access denied) }
 *       404: { description: Voice note not found }
 *       500: { description: Internal server error }
 */
router.get('/:id', /* authMiddleware, */ voiceNoteController.getVoiceNoteById); // Ligne 235 (environ) - Ancienne ligne d'erreur


// === DELETE ===
/**
 * @swagger
 * /api/voice-notes/{id}:
 *   delete:
 *     summary: Delete a voice note
 *     description: Deletes a specific voice note. Requires authentication and ownership.
 *     tags: [Voice Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The ID of the voice note to delete.
 *     responses:
 *       204: { description: Voice note deleted successfully (No Content) }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not owner) }
 *       404: { description: Voice note not found }
 *       500: { description: Internal server error }
 */
router.delete('/:id', authMiddleware, voiceNoteController.deleteVoiceNote); // Ligne 265 (environ)


// --- Définitions de Schémas Swagger ---
/**
 * @swagger
 * components:
 *   schemas:
 *     UserBase: # Utilisateur simplifié pour l'inclusion
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         username: { type: string }
 *         avatar: { type: string, nullable: true, description: "Relative path to avatar" }
 *     ReactionItem:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         user_id: { type: string, format: uuid }
 *         emoji: { type: string }
 *     VoiceNoteBase: # Champs communs des notes vocales
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         audio_url: { type: string, description: "Relative path to audio file" }
 *         duration: { type: integer, description: "Duration in seconds" }
 *         description: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     VoiceNoteFeedItem: # Pour la liste GET /
 *       allOf:
 *         - $ref: '#/components/schemas/VoiceNoteBase'
 *         - type: object
 *           properties:
 *             reactionCount: { type: integer, description: "Total number of reactions" }
 *             # commentCount: { type: integer, description: "Total number of comments" } # Si ajouté
 *             user: { $ref: '#/components/schemas/UserBase' }
 *             reactions:
 *               type: array
 *               items: { $ref: '#/components/schemas/ReactionItem' }
 *     MyVoiceNoteItem: # Pour la liste GET /my-notes
 *        allOf:
 *         - $ref: '#/components/schemas/VoiceNoteBase'
 *         - type: object
 *           properties:
 *             # Ne pas inclure 'user' car c'est toujours l'utilisateur courant
 *             reactions: # Inclure les réactions peut être utile
 *               type: array
 *               items: { $ref: '#/components/schemas/ReactionItem' }
 *     VoiceNoteDetail: # Pour GET /:id
 *       allOf:
 *         - $ref: '#/components/schemas/VoiceNoteBase'
 *         - type: object
 *           properties:
 *             updatedAt: { type: string, format: date-time }
 *             user_id: { type: string, format: uuid } # Peut être utile
 *             user: { $ref: '#/components/schemas/UserBase' }
 *             reactions:
 *               type: array
 *               items: { $ref: '#/components/schemas/ReactionItem' }
 *             # comments: # Décommenter si la relation/include est ajoutée
 *             #   type: array
 *             #   items: { $ref: '#/components/schemas/CommentDetail' } # Schéma à créer
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */


module.exports = router;