// server.js ou app.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet'); // Importer helmet
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const configureSwagger = require('./config/swagger');
const errorHandler = require('./middleware/errorHandler');
const morgan = require('morgan');

const app = express();

// ======================================
// SECURITY MIDDLEWARE (Placer en premier)
// ======================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // crossOriginEmbedderPolicy: false, // Décommenter si besoin
  })
);

// --- CONFIGURATION CORS ---
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
console.log(`[CORS] Configuration: Autorisation de l'origine : ${allowedOrigin}`);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigin === '*' || allowedOrigin === origin) {
      callback(null, true);
    } else {
       console.warn(`[CORS] Origine bloquée : ${origin} (Seule autorisée : ${allowedOrigin})`);
       callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard',
  keyGenerator: (req, res) => req.ip,
  standardHeaders: true,
	legacyHeaders: false,
});
app.use('/api', limiter);


// ======================================
// BASIC MIDDLEWARE
// ======================================
app.use(morgan('dev')); // Logging HTTP
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' })); // Parser JSON
app.use(express.urlencoded({ extended: true })); // Parser URL-encoded

// --- SERVICE DES FICHIERS STATIQUES ---
const publicDirectoryPath = path.join(__dirname, 'public');
console.log(`[Static] Configuration pour servir les fichiers statiques depuis: ${publicDirectoryPath}`);
const fs = require('fs');
if (!fs.existsSync(publicDirectoryPath)) {
    console.warn(`[Static] ATTENTION: Le dossier public "${publicDirectoryPath}" n'existe pas !`);
} else if (!fs.existsSync(path.join(publicDirectoryPath, 'uploads'))) {
    console.warn(`[Static] ATTENTION: Le sous-dossier "uploads" n'existe pas dans "${publicDirectoryPath}" ! Assurez-vous que Multer le crée ou créez-le manuellement.`);
}
app.use(express.static(publicDirectoryPath));

// ======================================
// DATABASE CONNECTION
// ======================================
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  }
};

// ======================================
// ROUTES API
// ======================================
const apiRouter = express.Router();

// Importer les routeurs
const authRoutes = require('./routes/authRoutes');
const voiceNoteRoutes = require('./routes/voiceNoteRoutes');
const reactionRoutes = require('./routes/reactionRoutes');
const commentRoutes = require('./routes/commentRoutes');
const shareRoutes = require('./routes/shareRoutes');
const reportRoutes = require('./routes/reportRoutes');

// ====> AJOUT : Importer le routeur des notifications
const notificationRoutes = require('./routes/notificationRoutes'); // Assurez-vous que le fichier existe

// Monter les routeurs sur apiRouter
apiRouter.use('/auth', authRoutes);
// Utilisation cohérente de '/voice-notes' (sans tiret)
console.log("[API Routes] Montage de voiceNoteRoutes sur /api/voice-notes");
apiRouter.use('/voice-notes', voiceNoteRoutes);
apiRouter.use('/reactions', reactionRoutes);
apiRouter.use('/comments', commentRoutes);
apiRouter.use('/shares', shareRoutes);
apiRouter.use('/reports', reportRoutes);

// ====> AJOUT : Monter le routeur des notifications
console.log("[API Routes] Montage de notificationRoutes sur /api/notifications");
apiRouter.use('/notifications', notificationRoutes);

// Appliquer le préfixe /api à toutes ces routes
app.use('/api', apiRouter);

// Route racine simple
app.get('/', (req, res) => {
  res.send('API Vocal Notes is running...');
});


// ======================================
// DOCUMENTATION & ERROR HANDLING (À la fin)
// ======================================
configureSwagger(app);
app.use(errorHandler); // Gestionnaire d'erreurs global

// ======================================
// SERVER STARTUP
// ======================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await initializeDatabase();
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
    console.log(`API docs available at http://localhost:${PORT}/api-docs`);
  });

  // Gestion de l'arrêt propre (graceful shutdown)
  const gracefulShutdown = (signal) => {
      console.log(`\n${signal} reçu. Fermeture du serveur...`);
      server.close(() => {
          console.log('Serveur HTTP fermé.');
          sequelize.close().then(() => {
              console.log('Connexion DB fermée.');
              process.exit(0); // Quitte proprement
          }).catch(err => {
               console.error('Erreur lors de la fermeture de la connexion DB:', err);
               process.exit(1); // Quitte avec erreur
          });
      });
       // Forcer la fermeture après un délai si nécessaire
       setTimeout(() => {
           console.error('Arrêt forcé après timeout.');
           process.exit(1);
       }, 10000); // 10 secondes timeout
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
};

startServer();

// --- Gestionnaires d'erreurs Node.js ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Envisager de fermer proprement le serveur ici dans certains cas
  // process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
   // Une exception non interceptée est grave, il est souvent recommandé de redémarrer.
  process.exit(1);
});

module.exports = app; // Export pour les tests éventuels