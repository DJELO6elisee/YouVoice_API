const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin'); // Assurez-vous que ce middleware est bien implémenté

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Content reporting management
 */

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Report a voice note
 *     description: Allows an authenticated user to report a specific voice note for review.
 *     tags: [Reports]
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
 *               - reason
 *             properties:
 *               voiceNoteId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the voice note being reported.
 *               reason:
 *                 type: string
 *                 description: The reason for reporting the voice note.
 *                 example: "Inappropriate content"
 *     responses:
 *       201:
 *         description: Report submitted successfully.
 *       400:
 *         description: Bad request (e.g., missing fields, invalid voiceNoteId).
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       404:
 *         description: Voice note not found.
 *       409:
 *         description: Conflict (e.g., user has already reported this voice note if duplicates are disallowed).
 */
router.post('/', authMiddleware, reportController.createReport);

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports (Admin access required)
 *     description: Retrieves a list of all reports, potentially filtered by status. Requires admin privileges.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: [] # Indique que l'authentification est requise (le middleware admin gère l'autorisation)
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, resolved]
 *         description: Filter reports by their status.
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
 *         description: A list of reports.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 # Définir le schéma d'un rapport détaillé
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   user_id:
 *                     type: string
 *                   voice_note_id:
 *                     type: string
 *                   reason:
 *                     type: string
 *                   status:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                   updated_at:
 *                     type: string
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       403:
 *         description: Forbidden (user is not an admin).
 */
router.get('/', authMiddleware, adminMiddleware, reportController.getReports);

/**
 * @swagger
 * /api/reports/{id}:
 *   patch:
 *     summary: Update a report's status (Admin access required)
 *     description: Allows an admin to update the status (and optionally add a resolution note) of a specific report. Requires admin privileges.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the report to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, resolved]
 *                 description: The new status for the report.
 *               resolution: # Champ optionnel pour ajouter une note de résolution
 *                 type: string
 *                 description: Optional notes on how the report was resolved.
 *     responses:
 *       200:
 *         description: Report updated successfully.
 *       400:
 *         description: Bad request (e.g., invalid status value).
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       403:
 *         description: Forbidden (user is not an admin).
 *       404:
 *         description: Report not found.
 */
router.patch('/:id', authMiddleware, adminMiddleware, reportController.updateReport);

module.exports = router;