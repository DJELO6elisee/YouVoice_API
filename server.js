
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http'); 
const { Server } = require("socket.io"); 
const { sequelize } = require('./models');
const configureSwagger = require('./config/swagger');
const errorHandler = require('./middleware/errorHandler');
const morgan = require('morgan');

// Importer le middleware d'authentification UNIQUEMENT pour Socket.IO
const socketAuth = require('./middleware/socketAuth'); 

// Importer les modèles nécessaires pour la logique Socket.IO
const { Message, Conversation, User, Sequelize } = require('./models');
const Op = Sequelize.Op;

const app = express();
// Création du serveur HTTP à partir de l'application Express
const server = http.createServer(app);

// --- CONFIGURATION CORS (pour HTTP et WebSocket) ---
const allowedOrigin = process.env.CORS_ORIGIN || 'https://youvoice-elisee.netlify.app'; // Ou votre URL de dev
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
app.use(cors(corsOptions)); // Appliquer CORS aux requêtes HTTP

// --- CONFIGURATION SOCKET.IO ---
const io = new Server(server, {
    cors: {
        origin: allowedOrigin, // Utiliser la même origine que pour HTTP
        methods: ["GET", "POST"]
    }
});


app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

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
    console.warn(`[Static] ATTENTION: Le sous-dossier "uploads" n'existe pas dans "${publicDirectoryPath}" !`);
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
const apiRouter = express.Router();

// Importer les routeurs
const authRoutes = require('./routes/authRoutes');
const voiceNoteRoutes = require('./routes/voiceNoteRoutes');
const reactionRoutes = require('./routes/reactionRoutes');
const commentRoutes = require('./routes/commentRoutes');
const shareRoutes = require('./routes/shareRoutes');
const reportRoutes = require('./routes/reportRoutes');
const conversationRoutes = require('./routes/conversationRoutes'); 
const notificationRoutes = require('./routes/notificationRoutes'); 

// L'authentification est gérée DANS chaque fichier de route si nécessaire
apiRouter.use('/auth', authRoutes);
apiRouter.use('/voice-notes', voiceNoteRoutes);
apiRouter.use('/reactions', reactionRoutes);
apiRouter.use('/comments', commentRoutes);
apiRouter.use('/shares', shareRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/conversations', conversationRoutes); 
apiRouter.use('/notifications', notificationRoutes); 

// Application du préfixe /api à toutes ces routes
app.use('/api', apiRouter);

// Route racine simple
app.get('/', (req, res) => {
  res.send('API YouVoice (with Chat) is running...');
});

// Utiliser le middleware Socket.IO depuis son fichier dédié
io.use(socketAuth); // Applique le middleware de middleware/socketAuth.js

const connectedUsers = {}; // { userId: socketId }

io.on('connection', (socket) => {
    // L'utilisateur est authentifié grâce à io.use(socketAuth)
    if (!socket.user || !socket.user.id) {
        console.error("[Socket.IO] Erreur critique: socket.user non défini après l'authentification. Déconnexion.");
        socket.disconnect(true);
        return;
    }
    const userId = socket.user.id;
    console.log(`[Socket.IO] ✅ Utilisateur connecté: ${userId}, Socket ID: ${socket.id}`);

    // Stocker l'ID du socket
    connectedUsers[userId] = socket.id;

    // Rejoindre une room personnelle
    socket.join(userId);
    console.log(`[Socket.IO] User ${userId} a rejoint sa room personnelle (${userId})`);

    // Gérer la demande de rejoindre une room de conversation
    socket.on('joinRoom', async (conversationId) => {
        if (!conversationId) return;
        console.log(`[Socket.IO] User ${userId} demande à rejoindre room ${conversationId}`);
        try {
             const isParticipant = await Conversation.findOne({
                 where: { id: conversationId },
                 include: [{ model: User, as: 'participants', where: { id: userId }, attributes: ['id'], through: { attributes: [] } }]
             });

             if (isParticipant) {
                 socket.join(conversationId);
                 console.log(`[Socket.IO] User ${userId} a rejoint la room ${conversationId} avec succès.`);
             } else {
                 console.warn(`[Socket.IO] ⚠️ Tentative non autorisée de User ${userId} de rejoindre la room ${conversationId}`);
             }
        } catch (error) {
             console.error(`[Socket.IO] 💥 Erreur joinRoom pour User ${userId}, Room ${conversationId}:`, error);
        }
    });

    // Gérer la demande de quitter une room de conversation
    socket.on('leaveRoom', (conversationId) => {
        if (!conversationId) return;
        console.log(`[Socket.IO] User ${userId} a quitté la room ${conversationId}`);
        socket.leave(conversationId);
    });

    // Gérer l'envoi d'un message
    socket.on('sendMessage', async (data) => {
        const { conversationId, content } = data;
        const senderId = socket.user.id; // Utilisateur authentifié

        console.log(`[Socket.IO] 📩 Message reçu de ${senderId} pour conv ${conversationId}: "${(content || '').substring(0, 50)}..."`);

        // Validation
        if (!conversationId || !content || typeof content !== 'string' || content.trim().length === 0) {
            console.error(`[Socket.IO] ❌ Payload sendMessage invalide de ${senderId}:`, data);
            return socket.emit('messageError', { message: 'Données de message invalides.' });
        }

        let transaction;
        try {
            transaction = await sequelize.transaction();

            // 1. Vérifier si l'utilisateur fait partie de la conversation
            const conversation = await Conversation.findOne({
                 where: { id: conversationId },
                 include: [{ model: User, as: 'participants', where: { id: senderId }, attributes: ['id'], through: {attributes: []} }],
                 transaction
            });

            if (!conversation) {
                 await transaction.rollback();
                 console.warn(`[Socket.IO] ⚠️ User ${senderId} non autorisé à envoyer à conv ${conversationId}`);
                 return socket.emit('messageError', { message: 'Vous ne faites pas partie de cette conversation.' });
            }

            // 2. Créer le message en base de données
            const newMessage = await Message.create({
                conversation_id: conversationId,
                sender_id: senderId,
                content: content.trim(),
            }, { transaction });

            // 3. Mettre à jour last_message_id et updatedAt de la conversation
            await Conversation.update(
                { last_message_id: newMessage.id },
                { where: { id: conversationId }, transaction }
            );

            await transaction.commit();

            // 4. Récupérer le message complet avec les infos de l'expéditeur pour l'envoyer aux clients
            const messageToSend = await Message.findByPk(newMessage.id, {
                include: [{
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'avatar']
                }]
            });

            if (messageToSend) {
                 // 5. Diffuser le message à tous les membres de la room
                 io.to(conversationId).emit('newMessage', messageToSend.toJSON());
                 console.log(`[Socket.IO] ✅ Message (${newMessage.id}) de ${senderId} diffusé à la room ${conversationId}`);
            } else {
                 console.error(`[Socket.IO] 💥 Message ${newMessage.id} créé mais non retrouvé après commit.`);
            }

        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error(`[Socket.IO] 💥 Erreur lors du traitement sendMessage de ${senderId}:`, error);
            socket.emit('messageError', { message: "Erreur interne, impossible d'envoyer le message." });
        }
    });

    // Gérer la déconnexion
    socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] 🔌 Utilisateur déconnecté: ${userId}, Socket ID: ${socket.id}, Raison: ${reason}`);
        if (connectedUsers[userId] === socket.id) {
            delete connectedUsers[userId];
             console.log(`[Socket.IO] User ${userId} retiré du mapping connectedUsers.`);
        }
    });

    // Gérer les erreurs de socket non interceptées
    socket.on('error', (err) => {
        console.error(`[Socket.IO] 💥 Erreur Socket pour User ${userId} (Socket ID: ${socket.id}):`, err);
    });
});


configureSwagger(app); // Swagger
app.use(errorHandler); // Gestionnaire d'erreurs global Express

// ======================================
// SERVER STARTUP
// ======================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await initializeDatabase();
  // Démarrer le serveur HTTP (qui contient l'app Express ET Socket.IO)
  server.listen(PORT, () => {
    console.log(`🚀 Serveur (HTTP + WebSocket) démarré en mode ${process.env.NODE_ENV || 'development'} sur le port ${PORT}`);
    console.log(`📚 API docs available at /api-docs`);
  });

  // Gestion de l'arrêt propre (graceful shutdown)
  const gracefulShutdown = (signal) => {
      console.log(`\n🚦 ${signal} reçu. Fermeture du serveur...`);
      io.close((err) => {
          if (err) { console.error('[Shutdown] Erreur fermeture Socket.IO:', err); }
          else { console.log('[Shutdown] Serveur Socket.IO fermé.'); }

          server.close(() => {
              console.log('[Shutdown] Serveur HTTP fermé.');
              sequelize.close().then(() => {
                  console.log('[Shutdown] Connexion DB fermée.');
                  process.exit(0);
              }).catch(dbErr => {
                   console.error('[Shutdown] Erreur fermeture connexion DB:', dbErr);
                   process.exit(1);
              });
          });
      });

       setTimeout(() => {
           console.error('[Shutdown] Arrêt forcé après timeout.');
           process.exit(1);
       }, 10000);
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();

// --- Gestionnaires d'erreurs Node.js ---
process.on('unhandledRejection', (reason, promise) => {
  console.error(' Unhandled Rejection at:', promise, 'reason:', reason);
  // process.exit(1); // Potentiellement arrêter le serveur ici
});
process.on('uncaughtException', (error) => {
  console.error(' Uncaught Exception:', error);
  process.exit(1); // Redémarrage recommandé
});

// --- Export ---
module.exports = server; 