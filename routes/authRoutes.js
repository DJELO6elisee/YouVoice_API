// routes/authRoutes.js
'use strict';

const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const router = express.Router();

// --- Vérification des Imports ---
let authController, authMiddleware, uploadAvatar, isAdmin, handleValidationErrors;
let controllerError, authMiddlewareError, adminMiddlewareError;

try {
    authController = require('../controllers/authController');
    // Vérifier que toutes les fonctions nécessaires sont exportées
    const requiredAdminFns = ['getAllUsers', 'updateUserStatus', 'getAdminStats', 'getUserStatsOverTime'];
    const requiredUserFns = ['register', 'login', 'getMe', 'updateMe'];
    for (const fnName of [...requiredUserFns, ...requiredAdminFns]) {
        if (typeof authController[fnName] !== 'function') {
             throw new Error(`La fonction '${fnName}' est manquante ou n'est pas une fonction dans authController.`);
        }
    }
} catch (e) {
    controllerError = `Erreur import authController: ${e.message}`;
    console.error(controllerError);
}

try {
    // ===> Adapter l'import selon l'export de ../middleware/auth <===
    // Si export direct (module.exports = function...)
    authMiddleware = require('../middleware/auth');
    // OU si export nommé (module.exports = { protect: function... })
    // const authModule = require('../middleware/auth'); authMiddleware = authModule.protect;

    if (typeof authMiddleware !== 'function') throw new Error('authMiddleware (protect) n\'est pas une fonction.');
} catch (e) {
    authMiddlewareError = `Erreur import authMiddleware: ${e.message}`;
    console.error(authMiddlewareError);
}

try {
    // ===> Adapter l'import selon l'export de ../middleware/admin <===
     // Si export direct (module.exports = function...)
    isAdmin = require('../middleware/admin');
     // OU si export nommé (module.exports = { isAdmin: function... })
     // const adminModule = require('../middleware/admin'); isAdmin = adminModule.isAdmin;

    if (typeof isAdmin !== 'function') throw new Error('isAdmin n\'est pas une fonction.');
} catch (e) {
    adminMiddlewareError = `Erreur import isAdmin: ${e.message}`;
    console.error(adminMiddlewareError);
}

try {
    const uploadUtils = require('../utils/upload');
    if (typeof uploadUtils?.uploadAvatar?.single !== 'function') throw new Error('uploadAvatar.single n\'est pas une fonction.');
    uploadAvatar = uploadUtils.uploadAvatar;
} catch (e) {
     console.error(`Erreur import uploadAvatar: ${e.message}`);
     // Gérer l'erreur si l'upload est critique
}


// ============================================
// == SWAGGER TAGS DÉFINITION                ==
// ============================================
/**
 * @swagger
 * tags:
 *   - name: Authentication & Profile
 *     description: User authentication and profile management endpoints
 *   - name: Admin - User Management
 *     description: Endpoints for administrators to manage users and stats
 */

// ============================================
// == MIDDLEWARE UTILITAIRE                  ==
// ============================================
handleValidationErrors = (req, res, next) => { // Assigner à la variable globale
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) {
        const fs = require('fs');
        console.warn('[Validation Error] Deleting uploaded file:', req.file.path);
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("[Validation Error] Failed to delete file:", err);
        });
    }
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};
// Vérifier si handleValidationErrors est bien une fonction
if (typeof handleValidationErrors !== 'function') {
    console.error("ERREUR CRITIQUE: handleValidationErrors n'a pas pu être défini correctement !");
}


// ============================================
// == FONCTION WRAPPER POUR VÉRIFICATION     ==
// ============================================
// Crée une fonction qui vérifie les handlers avant d'enregistrer la route
const safeRoute = (method, path, ...handlers) => {
    const routeArgs = [path];
    for (let i = 0; i < handlers.length; i++) {
        const handler = handlers[i];
        // Gérer le cas où le handler est un tableau (validations express-validator)
        if (Array.isArray(handler)) {
            routeArgs.push(handler); // Ajouter le tableau de validation tel quel
        } else if (typeof handler !== 'function') {
            const handlerName = handler?.name || `handler à l'index ${i}`;
            console.error(`ERREUR Route ${method.toUpperCase()} ${path}: Le handler '${handlerName}' n'est pas une fonction (type: ${typeof handler}). Vérifiez les imports/exports.`);
            // Optionnel : Lancer une erreur pour arrêter le serveur au démarrage si un handler est manquant
            // throw new Error(`Handler invalide pour la route ${method.toUpperCase()} ${path}`);
            // Ou simplement ne pas enregistrer la route (non recommandé car masque l'erreur)
            return;
        } else {
            routeArgs.push(handler); // Ajouter la fonction middleware/contrôleur valide
        }
    }
    // Appeler la méthode du routeur (get, post, patch) avec les arguments vérifiés
    router[method](...routeArgs);
};


// ============================================
// == ROUTES UTILISATEUR NORMAL (/api/auth/*) ==
// ============================================

// --- REGISTER ---
/** @swagger path: /api/auth/register ... */
safeRoute('post', '/register',
    [ /* validations */ ],
    handleValidationErrors,
    authController.register
);

// --- LOGIN ---
/** @swagger path: /api/auth/login ... */
safeRoute('post', '/login',
    [ /* validations */ ],
    handleValidationErrors,
    authController.login
);

// --- GET ME ---
/** @swagger path: /api/auth/me ... */
safeRoute('get', '/me',
    authMiddleware,
    authController.getMe
);

// --- UPDATE ME ---
/** @swagger path: /api/auth/me ... */
safeRoute('patch', '/me',
    authMiddleware,
    (req, res, next) => { // Wrapper pour Multer
        if (!uploadAvatar || typeof uploadAvatar.single !== 'function') {
             console.error("Middleware uploadAvatar.single non disponible");
             return res.status(500).send("Erreur config upload");
         }
         uploadAvatar.single('avatar')(req, res, next);
     },
    [ /* validations */ ],
    handleValidationErrors,
    authController.updateMe
);


// ============================================
// == ROUTES ADMIN (/api/auth/admin/*)       ==
// ============================================

// --- GET ALL USERS (Admin only) ---
/** @swagger path: /api/auth/admin/users ... */
safeRoute('get', '/admin/users',
    authMiddleware,
    isAdmin,
    authController.getAllUsers
);

// --- UPDATE USER STATUS (Admin only) ---
/** @swagger path: /api/auth/admin/users/{userId}/status ... */
safeRoute('patch', '/admin/users/:userId/status',
    authMiddleware,
    isAdmin,
    [ // Validations
        param('userId', 'Format ID invalide').isUUID(),
        body('isActive', 'Champ isActive (booléen) requis').isBoolean()
    ],
    handleValidationErrors,
    authController.updateUserStatus
);

// --- GET ADMIN STATS ---
/** @swagger path: /api/auth/admin/stats ... */
safeRoute('get', '/admin/stats',
    authMiddleware,
    isAdmin,
    authController.getAdminStats
);

// --- GET USER STATS OVER TIME ---
/** @swagger path: /api/auth/admin/stats/users-over-time ... */
safeRoute('get', '/admin/stats/users-over-time',
    authMiddleware,
    isAdmin,
    authController.getUserStatsOverTime
);


// ============================================
// == SWAGGER COMPONENTS DEFINITIONS         ==
// ============================================
// (Assurez-vous que cette section est correctement indentée en YAML)
/**
 * @swagger
 * components:
 *   schemas:
 *     # --- Schémas Auth/Profile ---
 *     RegisterInput:
 *       type: object
 *       required: [username, email, password]
 *       properties:
 *         username: { type: string }
 *         email: { type: string, format: email }
 *         password: { type: string, format: password, minLength: 6 }
 *     RegisterSuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         user: { $ref: '#/components/schemas/UserResponse' }
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email }
 *         password: { type: string, format: password }
 *     LoginSuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         token: { type: string, format: jwt }
 *         user: { $ref: '#/components/schemas/UserResponse' }
 *     ProfileSuccessResponse:
 *       type: object
 *       properties:
 *         status: { type: string, example: success }
 *         message: { type: string, optional: true }
 *         data:
 *           type: object
 *           properties:
 *             user: { $ref: '#/components/schemas/UserResponse' }
 *     UserResponse: # Utilisateur sans mot de passe
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         username: { type: string }
 *         email: { type: string, format: email }
 *         avatar: { type: string, nullable: true, format: url }
 *         bio: { type: string, nullable: true }
 *         fullName: { type: string, nullable: true }
 *         genre: { type: string, enum: [homme, femme, autre], nullable: true }
 *         pays: { type: string, nullable: true }
 *         isAdmin: { type: boolean }
 *         isActive: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     # --- Schémas Erreurs ---
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string }
 *     ValidationErrorResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type: { type: string }
 *               value: {}
 *               msg: { type: string }
 *               path: { type: string }
 *               location: { type: string }
 *     # --- Schémas Admin ---
 *     UserListResponse:
 *       type: object
 *       properties:
 *         status: { type: string, example: success }
 *         results: { type: integer }
 *         totalUsers: { type: integer }
 *         totalPages: { type: integer }
 *         currentPage: { type: integer }
 *         data:
 *           type: object
 *           properties:
 *             users:
 *               type: array
 *               items: { $ref: '#/components/schemas/UserResponse' }
 *     AdminStatsResponse:
 *       type: object
 *       properties:
 *         status: { type: string, example: success }
 *         data:
 *           type: object
 *           properties:
 *             totalUsers: { type: integer }
 *             totalVoiceNotes: { type: integer }
 *             pendingReports: { type: integer }
 *     ChartDataResponse:
 *       type: object
 *       properties:
 *         status: { type: string, example: success }
 *         data:
 *           type: object
 *           properties:
 *             labels: { type: array, items: { type: string } }
 *             values: { type: array, items: { type: number } }
 *
 *   responses: # Réponses génériques réutilisables
 *     UnauthorizedError:
 *       description: Unauthorized (Token missing or invalid)
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *     ForbiddenError:
 *       description: Forbidden (User does not have permission)
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *     NotFoundError:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *     ServerError:
 *       description: Internal Server Error
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// routes/adminRoutes.js ou authRoutes.js


// ... (autres imports et routes) ...

// --- GET ACTIVITY STATS OVER TIME ---
/** @swagger
 * /api/X/admin/stats/activity-over-time:
 *   get:
 *     summary: Get daily user registration and voice note creation stats (Admin)
 *     tags: [Admin - User Management]
 *     security: [- bearerAuth: []]
 *     parameters:
 *       - { name: days, in: query, schema: { type: integer, default: 30 }, description: "Number of past days to include" }
 *     responses:
 *       200:
 *         description: Data formatted for multi-line charts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MultiLineChartDataResponse' # Schéma à définir
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
safeRoute('get', // Ou router.get si vous n'utilisez pas safeRoute
    '/admin/stats/activity-over-time', // Le chemin relatif
    authMiddleware, // 1. Vérifie connexion
    isAdmin,        // 2. Vérifie rôle admin
    [ // 3. Validation optionnelle du paramètre 'days'
        query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Le nombre de jours doit être un entier entre 1 et 365.')
    ],
    handleValidationErrors, // 4. Gérer erreurs validation
    authController.getActivityStatsOverTime // 5. Appeler le bon contrôleur
);

// --- Définition Swagger ---
/**
 * @swagger
 * components:
 *   schemas:
 *     # ... (vos autres schémas) ...
 *     MultiLineChartDataset:
 *       type: object
 *       properties:
 *         label: { type: string }
 *         values: { type: array, items: { type: number } }
 *     MultiLineChartDataResponse:
 *       type: object
 *       properties:
 *         status: { type: string, example: success }
 *         data:
 *           type: object
 *           properties:
 *              labels: { type: array, items: { type: string, format: date } }
 *              datasets: { type: array, items: { $ref: '#/components/schemas/MultiLineChartDataset' } }
 */

module.exports = router;