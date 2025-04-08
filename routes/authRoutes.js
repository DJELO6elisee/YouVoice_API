const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController'); // Assure-toi que c'est le bon contrôleur (userController?)
const authMiddleware = require('../middleware/auth');
// --- MODIFICATION: Importer spécifiquement uploadAvatar ---
const { uploadAvatar } = require('../utils/upload'); // Ajuste le chemin si nécessaire

/**
 * @swagger
 * tags:
 *   name: Authentication & Profile
 *   description: User authentication and profile management endpoints
 */

// --- Middleware pour gérer les erreurs de validation ---
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Si un fichier a été uploadé malgré l'erreur de validation, le supprimer
    if (req.file) {
        const fs = require('fs');
        // const path = require('path'); // Pas besoin ici, req.file.path est absolu
        console.warn('[Validation Error] Deleting uploaded file due to validation errors:', req.file.path);
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("[Validation Error] Failed to delete uploaded file:", err);
        });
    }
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// --- REGISTER ---
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication & Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201: { description: User registered successfully, content: { application/json: { schema: { $ref: '#/components/schemas/RegisterSuccessResponse' } } } }
 *       400: { description: Bad request (validation error) }
 *       409: { description: Conflict (username or email already exists) }
 *       500: { description: Server error }
 */
router.post(
    '/register',
    [
        body('username', 'Username is required').not().isEmpty().trim().escape(),
        body('email', 'Please include a valid email').isEmail().normalizeEmail(),
        body('password', 'Password must be 6 or more characters').isLength({ min: 6 })
    ],
    handleValidationErrors,
    authController.register // Ou userController.register si séparé
);

// --- LOGIN ---
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Authentication & Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200: { description: Login successful, content: { application/json: { schema: { $ref: '#/components/schemas/LoginSuccessResponse' } } } }
 *       400: { description: Bad request (validation error) }
 *       401: { description: Invalid credentials }
 *       500: { description: Server error }
 */
router.post(
    '/login',
    [
        body('email', 'Please include a valid email').isEmail().normalizeEmail(),
        body('password', 'Password is required').exists({ checkFalsy: true })
    ],
    handleValidationErrors,
    authController.login // Ou userController.login si séparé
);

// --- GET CURRENT USER PROFILE ---
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current logged-in user profile
 *     tags: [Authentication & Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Current user data, content: { application/json: { schema: { $ref: '#/components/schemas/ProfileSuccessResponse' } } } }
 *       401: { description: Unauthorized }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.get(
    '/me',
    authMiddleware, // Appliquer auth d'abord
    authController.getMe // Ou userController.getMe si séparé
);


// --- AJOUT: UPDATE CURRENT USER PROFILE ---
/**
 * @swagger
 * /api/auth/me:
 *   patch:
 *     summary: Update current logged-in user profile
 *     tags: [Authentication & Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data: # Utiliser multipart si l'avatar peut être uploadé
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *                 example: Johnathan Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address (if change allowed)
 *                 example: john.doe.new@example.com
 *               genre:
 *                 type: string
 *                 enum: [homme, femme, autre, null] # Valeurs possibles ou null
 *                 nullable: true
 *                 description: User's gender
 *                 example: homme
 *               pays:
 *                 type: string
 *                 description: User's country code or name
 *                 example: CI
 *               bio:
 *                 type: string
 *                 description: User's biography
 *                 example: Developer and coffee enthusiast.
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Optional new avatar image file (jpg, png, webp)
 *     responses:
 *       200: { description: Profile updated successfully, content: { application/json: { schema: { $ref: '#/components/schemas/ProfileSuccessResponse' } } } }
 *       400: { description: Bad request (validation error) }
 *       401: { description: Unauthorized }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.patch( // Utiliser PATCH pour mise à jour partielle, PUT si remplacement complet
    '/me',
    authMiddleware, // 1. Vérifier l'authentification
    // --- MODIFICATION: Utiliser uploadAvatar au lieu de upload ---
    uploadAvatar.single('avatar'), // 2. Gérer l'upload de fichier AVATAR (le champ doit s'appeler 'avatar')
    [ // 3. Validation (Optionnelle mais recommandée pour les champs texte)
      body('email').optional({ checkFalsy: true }).isEmail().withMessage('Veuillez fournir un email valide.').normalizeEmail(),
      body('fullName').optional().trim().escape(),
      body('bio').optional().trim().escape(),
    ],
    handleValidationErrors, // 4. Gérer les erreurs de validation
    authController.updateMe // 5. Appeler le contrôleur pour la logique de mise à jour (Ou userController.updateMe)
);


// --- SWAGGER COMPONENTS DEFINITIONS (Inchangés) ---
/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterInput: { ... }
 *     RegisterSuccessResponse: { ... }
 *     LoginInput: { ... }
 *     LoginSuccessResponse: { ... }
 *     ProfileSuccessResponse: { ... }
 *     UserResponse: { ... }
 *   securitySchemes:
 *     bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
 */

module.exports = router;