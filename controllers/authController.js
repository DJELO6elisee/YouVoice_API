// controllers/authController.js
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

const db = require('../models');
// Extraire les modèles et l'instance/classe Sequelize depuis 'db'
const { User, VoiceNote, Report, Comment, Sequelize } = db;
const sequelize = db.sequelize; // Récupère l'INSTANCE sequelize
const Op = Sequelize.Op; // Récupère la CLASSE Sequelize.Op
// ===> FIN MODIFICATION IMPORTATION <===

// Vérification au démarrage (optionnel mais utile)
if (!sequelize || typeof sequelize.getDialect !== 'function') {
    console.error("ERREUR CRITIQUE: L'instance sequelize n'a pas été importée correctement depuis ../models !");
    // Vous pourriez vouloir arrêter le processus ici dans un cas réel
    // process.exit(1);
} else {
    console.log("[authController] Instance sequelize importée avec succès. Dialecte:", sequelize.getDialect());
}

// --- Fonction d'Inscription (Register) ---
exports.register = async (req, res, next) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ where: { [Op.or]: [{ email: email }, { username: username }] } });
        if (existingUser) {
            const field = existingUser.email === email ? 'Email' : 'Username';
            return res.status(409).json({ success: false, message: `${field} already exists.` });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        // Assurez-vous que les champs correspondent à votre modèle User (ex: pas de isActive par défaut ici)
        const newUser = await User.create({ username, email, password: hashedPassword });
        // Exclure le mot de passe de la réponse
        const userResponse = { ...newUser.toJSON() };
        delete userResponse.password;
        res.status(201).json({ success: true, message: 'User registered successfully.', user: userResponse });
    } catch (error) {
        console.error('Registration Error:', error);
        if (error.name === 'SequelizeValidationError') {
             return res.status(400).json({ success: false, message: 'Validation error.', errors: error.errors.map(e => ({ msg: e.message, path: e.path })) });
        }
        // Utiliser next pour le gestionnaire d'erreurs global
        next(error);
    }
};

// --- Fonction de Connexion (Login) ---
exports.login = async (req, res, next) => {
    console.log('--- Login attempt started ---');
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email: email } });
        if (!user) {
            console.log(`[Login] User not found for email: ${email}`);
            return res.status(401).json({ success: false, message: 'Identifiants invalides.' }); // Message générique
        }
        console.log(`[Login] User found: ${user.id}. Checking password...`);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[Login] Password mismatch for user: ${user.id}`);
            return res.status(401).json({ success: false, message: 'Identifiants invalides.' }); // Message générique
        }
        console.log(`[Login] Password matched for user: ${user.id}`);

        // ===> MODIFICATION IMPORTANTE: Inclure le statut admin dans le payload JWT <===
        const payload = {
            user: {
              id: user.id,
              // Assurez-vous que le nom 'isAdmin' correspond à votre modèle User
              // Si vous utilisez 'role', mettez 'role: user.role' à la place
              isAdmin: user.isAdmin
            }
        };
        // ===> FIN MODIFICATION JWT PAYLOAD <===

        const secret = process.env.JWT_SECRET;
        const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
        if (!secret) {
            console.error("FATAL ERROR: JWT_SECRET is not defined!");
            // Ne pas appeler next() ici car c'est une erreur serveur critique
            return res.status(500).json({ success: false, message: "Erreur de configuration serveur."});
        }

        jwt.sign( payload, secret, { expiresIn: expiresIn }, (err, token) => {
            if (err) {
                console.error('JWT Signing Error:', err);
                // Il vaut mieux passer l'erreur au handler global ici
                return next(new Error('Failed to generate authentication token.'));
            }
            console.log('[Login] JWT signed successfully.');
            // Exclure le mot de passe de la réponse utilisateur
            const userResponse = { ...user.toJSON() };
            delete userResponse.password;
            res.status(200).json({ success: true, message: 'Login successful.', token: token, user: userResponse });
        });
    } catch (error) {
        console.error('--- Login Controller General Error Catch ---', error);
        next(error); // Passer à errorHandler
    }
};

// --- Fonction pour récupérer l'utilisateur connecté (/me) ---
exports.getMe = async (req, res, next) => {
    try {
        // req.user est défini par le middleware d'authentification (authMiddleware)
        if (!req.user || !req.user.id) {
            return res.status(401).json({ status: 'fail', message: 'Non autorisé: Impossible d\'identifier l\'utilisateur.' });
        }
        const userId = req.user.id;
        // Récupérer l'utilisateur SANS le mot de passe
        const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
        if (!user) {
            // Token valide mais utilisateur supprimé entre temps ?
            return res.status(404).json({ status: 'fail', message: 'Utilisateur associé à ce token introuvable.' });
        }
        res.status(200).json({ status: 'success', data: { user: user.toJSON() } }); // Utiliser toJSON
    } catch (error) {
        console.error('GetMe Error:', error);
        next(error);
    }
};

// --- Fonction pour mettre à jour l'utilisateur connecté (/me) ---
exports.updateMe = async (req, res, next) => {
    // ... (Garder votre code de mise à jour de profil existant et fonctionnel) ...
    // Assurez-vous qu'il utilise bien 'req.user.id' et gère l'upload d'avatar si nécessaire
     console.log('--- updateMe Controller Start ---');
    if (!req.user || !req.user.id) { return res.status(401).json({ status: 'fail', message: 'Auth requise.' }); }
    const userId = req.user.id;
    const allowedUpdates = ['fullName', 'email', 'genre', 'pays', 'bio'];
    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
             filteredBody[key] = (req.body[key] === '') ? null : req.body[key];
        }
    });
    let newAvatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;
    if (Object.keys(filteredBody).length === 0 && !newAvatarPath) {
        try { const currentUser = await User.findByPk(userId, { attributes: { exclude: ['password'] } }); return res.status(200).json({ status: 'success', message: 'Aucune modif.', data: { user: currentUser } }); }
        catch (fetchError) { return next(fetchError); }
    }
    try {
        const user = await User.findByPk(userId);
        if (!user) { if (req.file) await unlinkAsync(req.file.path).catch(console.error); return res.status(404).json({ status: 'fail', message: 'Utilisateur non trouvé.' }); }
        const updateData = { ...filteredBody };
        let oldAvatarPath = user.avatar;
        if (newAvatarPath) updateData.avatar = newAvatarPath;
        Object.assign(user, updateData);
        await user.save();
        if (newAvatarPath && oldAvatarPath) {
            const absoluteOldPath = path.join(__dirname, '..', 'public', oldAvatarPath);
            await unlinkAsync(absoluteOldPath).catch(err => console.error(`[UpdateMe] Erreur suppression ancien avatar:`, err.message));
        }
        const updatedUserResponse = { ...user.toJSON() };
        delete updatedUserResponse.password;
        res.status(200).json({ status: 'success', message: 'Profil mis à jour.', data: { user: updatedUserResponse } });
    } catch (error) {
        if (req.file) await unlinkAsync(req.file.path).catch(err => console.error('[UpdateMe] Erreur suppression fichier uploadé (DB save fail):', err));
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ status: 'fail', message: 'Validation échouée.', errors: error.errors?.map(e => ({ field: e.path, message: e.message })) });
        }
        next(error);
    }
};


// =======================================
// === NOUVELLES FONCTIONS ADMIN       ===
// =======================================

// --- Lister TOUS les Utilisateurs (Admin) ---
exports.getAllUsers = async (req, res, next) => {
    console.log("[Admin - getAllUsers] Query params:", req.query);
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        const statusFilter = req.query.status || '';

        const whereClause = {};
        if (statusFilter === 'active') whereClause.isActive = true;
        else if (statusFilter === 'blocked') whereClause.isActive = false;
        if (searchTerm) {
            whereClause[Op.or] = [
                { username: { [Op.iLike]: `%${searchTerm}%` } },
                { email: { [Op.iLike]: `%${searchTerm}%` } }
            ];
        }

        const { count, rows: users } = await User.findAndCountAll({
            where: whereClause,
            attributes: { exclude: ['password'] },
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset,
        });

        const totalPages = Math.ceil(count / limit);
        res.status(200).json({
            status: 'success', results: users.length, totalUsers: count,
            totalPages: totalPages, currentPage: page,
            data: { users: users.map(u => u.toJSON()) }
        });

    } catch (error) {
        console.error("[Admin - getAllUsers] Error:", error);
        next(error);
    }
};

// --- Modifier le Statut d'un Utilisateur (Admin) ---
exports.updateUserStatus = async (req, res, next) => {
    const targetUserId = req.params.userId;
    const adminUserId = req.user.id; // Défini par 'protect' middleware
    const { isActive } = req.body;

    console.log(`[Admin - updateUserStatus] Admin ${adminUserId} updating User ${targetUserId} -> isActive: ${isActive}`);

    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ status: 'fail', message: "Le champ 'isActive' (booléen) est requis." });
    }
    if (targetUserId === adminUserId) {
         return res.status(403).json({ status: 'fail', message: "Un administrateur ne peut pas modifier son propre statut." });
    }

    try {
        const userToUpdate = await User.findByPk(targetUserId);
        if (!userToUpdate) { return res.status(404).json({ status: 'fail', message: "Utilisateur cible non trouvé." }); }

        userToUpdate.isActive = isActive;
        await userToUpdate.save();
        console.log(`[Admin - updateUserStatus] User ${targetUserId} status updated to isActive: ${isActive}`);

        res.status(200).json({ status: 'success', message: `Statut utilisateur mis à jour.` });
    } catch (error) {
        console.error(`[Admin - updateUserStatus] Error updating user ${targetUserId}:`, error);
        next(error);
    }
};

// --- Obtenir les Statistiques pour le Dashboard (Admin) ---
exports.getAdminStats = async (req, res, next) => {
     console.log("[Admin - getAdminStats] Request received.");
     try {
        const [userCount, voiceNoteCount, pendingReportCount] = await Promise.all([
            User.count(),
            VoiceNote.count(), // Assurez-vous que VoiceNote est importé
            Report.count({ where: { status: 'pending' }}) // Assurez-vous que Report est importé
        ]);
        const statsData = { totalUsers: userCount, totalVoiceNotes: voiceNoteCount, pendingReports: pendingReportCount };
        console.log("[Admin - getAdminStats] Stats calculated:", statsData);
        res.status(200).json({ status: 'success', data: statsData });
     } catch(error) {
         console.error("[Admin - getAdminStats] Error:", error);
         next(error);
     }
};

// --- Obtenir les Données pour Graphique Utilisateurs par Mois (Admin - Adapté pour MySQL) ---
exports.getUserStatsOverTime = async (req, res, next) => {
    console.log("[Admin - getUserStatsOverTime - MySQL] Request received.");
    try {
        // Obtenir la date d'il y a 12 mois
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        // --- Utilisation de DATE_FORMAT pour MySQL ---
        const dateFormater = Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m');

        // Requête pour regrouper les utilisateurs par mois de création
        const usersByMonth = await User.findAll({
            attributes: [
                [dateFormater, 'month'], // Alias 'month' pour la date formatée YYYY-MM
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'] // Compter les utilisateurs
            ],
            where: {
                // Filtrer sur les 12 derniers mois (utilise le nom de colonne snake_case)
                created_at: { [Op.gte]: twelveMonthsAgo }
            },
            // Grouper par l'expression de formatage de date
            group: [dateFormater],
             // Trier par l'expression de formatage de date
            order: [[dateFormater, 'ASC']],
            raw: true // Renvoyer des objets JSON simples
        });

        // Formater les résultats pour Chart.js
        const labels = usersByMonth.map(item => item.month); // Récupère les 'YYYY-MM'
        const values = usersByMonth.map(item => item.count); // Récupère les comptes

        console.log("[Admin - getUserStatsOverTime - MySQL] Data prepared:", { labels, values });

        res.status(200).json({
            status: 'success',
            data: { labels, values } // Envoyer les données formatées
        });

    } catch(error) {
        console.error("[Admin - getUserStatsOverTime - MySQL] Error:", error);
        // Log l'erreur SQL originale si disponible (utile pour déboguer MySQL)
        if (error.original) {
             console.error("[Admin - getUserStatsOverTime - MySQL] Original SQL Error:", error.original.sqlMessage || error.original);
        }
        next(error); // Passer au gestionnaire d'erreurs global
    }
};

// --- Obtenir les Données pour le Graphique d'Activité par Jour (Admin) ---
exports.getActivityStatsOverTime = async (req, res, next) => {
    console.log("[Admin - getActivityStatsOverTime] Request received.");
    try {
        const daysToGoBack = parseInt(req.query.days, 10) || 30;
        const startDate = new Date(); startDate.setDate(startDate.getDate() - daysToGoBack); startDate.setHours(0, 0, 0, 0);

        let dateFunction;
        // Utiliser l'instance sequelize importée pour obtenir le dialecte
        const dialect = sequelize.getDialect();
        console.log(`[Admin - getActivityStatsOverTime] Dialect: ${dialect}`);

        // Fonction de date pour YYYY-MM-DD
        if (dialect === 'mysql') {
             // Utiliser la classe Sequelize (importée via déstructuration) pour les fonctions
             dateFunction = Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d');
        } else if (dialect === 'postgres') {
             dateFunction = Sequelize.fn('TO_CHAR', Sequelize.col('created_at'), 'YYYY-MM-DD');
        } else if (dialect === 'sqlite') {
             dateFunction = Sequelize.fn('strftime', '%Y-%m-%d', Sequelize.col('created_at'));
        } else {
             console.warn("Dialecte non géré pour agrégation jour. Tentative fallback.");
             dateFunction = Sequelize.fn('SUBSTR', Sequelize.cast(Sequelize.col('created_at'), 'string'), 1, 10);
        }

        // --- Requêtes parallèles ---
        console.log(`[Admin - getActivityStatsOverTime] Fetching data from ${startDate.toISOString().split('T')[0]}...`);
        const [usersByDay, notesByDay] = await Promise.all([
            User.findAll({
                attributes: [ [dateFunction, 'day'], [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'] ],
                where: { created_at: { [Op.gte]: startDate } }, group: [dateFunction], order: [[dateFunction, 'ASC']], raw: true
            }),
            VoiceNote.findAll({
                attributes: [ [dateFunction, 'day'], [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'] ],
                where: { created_at: { [Op.gte]: startDate } }, group: [dateFunction], order: [[dateFunction, 'ASC']], raw: true
            })
        ]);

        // --- VÉRIFICATION DES DONNÉES BRUTES ---
        console.log("[Admin - getActivityStatsOverTime] Raw usersByDay data:", JSON.stringify(usersByDay, null, 2));
        console.log("[Admin - getActivityStatsOverTime] Raw notesByDay data:", JSON.stringify(notesByDay, null, 2));

        // --- Combinaison et Formatage ---
        console.log("[Admin - getActivityStatsOverTime] Formatting data...");
        const usersMap = new Map(usersByDay.map(item => [item.day, parseInt(item.count, 10) || 0]));
        const notesMap = new Map(notesByDay.map(item => [item.day, parseInt(item.count, 10) || 0]));

        const labels = []; const usersData = []; const notesData = [];
        let currentDate = new Date(startDate); const today = new Date(); today.setHours(23, 59, 59, 999);

        while (currentDate <= today) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            labels.push(dateString);
            usersData.push(usersMap.get(dateString) || 0);
            notesData.push(notesMap.get(dateString) || 0);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(`[Admin - getActivityStatsOverTime] Data prepared for ${labels.length} days.`);
        // Optionnel: logguer les données finales si besoin de déboguer le formatage
        // console.log("[Admin - getActivityStatsOverTime] Final labels:", labels);
        // console.log("[Admin - getActivityStatsOverTime] Final usersData:", usersData);
        // console.log("[Admin - getActivityStatsOverTime] Final notesData:", notesData);

        // --- Réponse API ---
        res.status(200).json({
            status: 'success',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Utilisateurs Créés', values: usersData },
                    { label: 'Notes Créées', values: notesData }
                ]
            }
        });

    } catch(error) {
        console.error("[Admin - getActivityStatsOverTime] Error:", error);
        if (error.original) {
             console.error("[Admin - getActivityStatsOverTime] Original SQL Error:", error.original.sqlMessage || error.original);
        }
        next(error);
    }
};

// / === Obtenir la liste des signalements (POUR ADMIN) ===
exports.getAllReports = async (req, res, next) => {
  // La vérification isAdmin est faite par le middleware
  console.log("[Admin - getAllReports] Request received. Query:", req.query);
  try {
    const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = req.query;
    const where = {};
    const validStatuses = ['pending', 'resolved', 'rejected']; // Simplifié, ou Report.getAttributes()...
    if (status && validStatuses.includes(status)) { where.status = status; }
    else if (status) { return res.status(400).json(/* ... */); }

    const orderClause = [];
    const sortMapping = { createdAt: 'created_at', status: 'status' };
    const sortField = sortMapping[sortBy] || 'created_at';
    const sortDirection = ['ASC', 'DESC'].includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
    orderClause.push([sortField, sortDirection]);
    if (sortField !== 'id') orderClause.push(['id', 'DESC']);

    const offset = (page - 1) * limit;

    const { count, rows: reports } = await Report.findAndCountAll({
      where,
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'avatar'] },
        {
          model: VoiceNote, as: 'reportedVoiceNote', required: false, // Ne pas planter si note supprimée
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }]
        },
        // Ajouter include pour 'resolvedBy' si vous avez cette colonne/association
        // { model: User, as: 'resolvedBy', attributes: ['id', 'username'], required: false }
      ],
      order: orderClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      distinct: true
    });

    console.log(`[Admin - getAllReports] Found ${count} reports, returning ${reports.length}.`);
    res.status(200).json({
      status: 'success', results: reports.length, totalReports: count,
      totalPages: Math.ceil(count / limit), currentPage: parseInt(page, 10),
      data: { reports: reports.map(r => r.toJSON()) }
    });
  } catch (error) {
    console.error("[Admin - getAllReports] Error:", error);
    next(error);
  }
};

// === Mettre à jour un signalement (POUR ADMIN) ===
exports.updateReportStatus = async (req, res, next) => {
  // La vérification isAdmin est faite par le middleware
  const reportId = req.params.reportId; // Utiliser un nom de paramètre clair
  const adminUserId = req.user.id;
  const { status, resolution } = req.body;
  console.log(`[Admin - updateReportStatus] Admin ${adminUserId} updating report ${reportId}. Body:`, req.body);

  try {
    const validStatuses = ['pending', 'resolved', 'rejected']; // Simplifié
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ status: 'fail', message: `Statut invalide: ${status}.` });
    }
    if (['resolved', 'rejected'].includes(status) && (!resolution || String(resolution).trim() === '')) {
      return res.status(400).json({ status: 'fail', message: 'Note de résolution requise.' });
    }

    const report = await Report.findByPk(reportId);
    if (!report) { return res.status(404).json({ status: 'fail', message: 'Signalement non trouvé.' }); }

    const updateData = { status: status, resolution: resolution };
    // Enregistrer qui a résolu et quand
    if (['resolved', 'rejected'].includes(status)) {
        updateData.resolved_by_id = adminUserId; // Assurez-vous que cette colonne existe
        updateData.resolved_at = new Date();    // Assurez-vous que cette colonne existe
    }

    const [affectedRows] = await Report.update(updateData, { where: { id: reportId } });

    if (affectedRows === 0) { return res.status(404).json({ status: 'fail', message: 'Signalement non trouvé lors MàJ.' }); }

    console.log(`[Admin - updateReportStatus] Report ${reportId} updated.`);
    // Recharger pour la réponse
    const updatedReport = await Report.findByPk(reportId, {
         include: [
            { model: User, as: 'reporter', attributes: ['id', 'username', 'avatar'] },
        {
          model: VoiceNote, as: 'reportedVoiceNote', required: false, // Ne pas planter si note supprimée
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }]
        },
         ]
    });

    res.status(200).json({
        status: 'success', message: 'Signalement mis à jour.',
        data: { report: updatedReport ? updatedReport.toJSON() : null }
    });
  } catch (error) {
    console.error(`[Admin - updateReportStatus] Error updating report ${reportId}:`, error);
    next(error);
  }
};

// Optionnel: Fonction pour supprimer du contenu signalé
exports.deleteReportedContent = async (req, res, next) => {
    const { itemType, itemId } = req.params; // ex: /api/admin/content/voice-note/uuid-de-la-note
    const adminUserId = req.user.id;
    console.log(`[Admin - deleteReportedContent] Admin ${adminUserId} deleting ${itemType} ID ${itemId}`);

    try {
        let modelToDelete;
        if (itemType === 'voice-note') {
             modelToDelete = VoiceNote;
        } else if (itemType === 'comment') {
             modelToDelete = Comment; // Assurez-vous d'importer Comment
        } else {
             return res.status(400).json({ status: 'fail', message: 'Type de contenu invalide.'});
        }

        const item = await modelToDelete.findByPk(itemId);
        if (!item) {
            return res.status(404).json({ status: 'fail', message: 'Contenu non trouvé.'});
        }

        // Logique de suppression (ex: supprimer le fichier audio avant de détruire l'enregistrement DB)
        if (itemType === 'voice-note' && item.audio_url) {
             // ... (logique fs.unlink comme dans deleteVoiceNote) ...
             const absolutePath = path.join(__dirname, '..', 'public', item.audio_url);
             await unlinkAsync(absolutePath).catch(err => console.error(`Échec suppression fichier ${item.audio_url}: ${err.message}`));
        }

        await item.destroy();
        console.log(`[Admin - deleteReportedContent] ${itemType} ID ${itemId} supprimé.`);

        // Mettre à jour tous les rapports PENDING pour cet item vers RESOLVED ?
         await Report.update(
             { status: 'resolved', resolution: `Contenu supprimé par Admin ${adminUserId}`, resolved_by_id: adminUserId, resolved_at: new Date() },
             { where: { voice_note_id: itemId, status: 'pending' } } // reported_item_id doit exister dans Report model
         );

        res.status(200).json({ status: 'success', message: 'Contenu supprimé et rapports associés mis à jour.' });

    } catch (error) {
        console.error(`[Admin - deleteReportedContent] Error deleting ${itemType} ID ${itemId}:`, error);
        next(error);
    }
};