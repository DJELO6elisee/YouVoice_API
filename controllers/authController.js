const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs'); // Module File System pour supprimer l'ancien avatar
const path = require('path'); // Module Path pour construire les chemins de fichiers
const { promisify } = require('util'); // Pour utiliser fs.unlink avec async/await
const unlinkAsync = promisify(fs.unlink); // Version async de fs.unlink

// Importer User ET la classe Sequelize pour accéder à Op
const { User, Sequelize } = require('../models'); // Ajustez le chemin si nécessaire
const Op = Sequelize.Op; // Obtenir l'opérateur Op

// --- Fonction d'Inscription (Register) ---
exports.register = async (req, res, next) => {
    // ... (code register existant - inchangé) ...
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ where: { [Op.or]: [{ email: email }, { username: username }] } });
        if (existingUser) {
            const field = existingUser.email === email ? 'Email' : 'Username';
            return res.status(409).json({ success: false, message: `${field} already exists.` });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = await User.create({ username, email, password: hashedPassword });
        const userResponse = {
            id: newUser.id, username: newUser.username, email: newUser.email,
            avatar: newUser.avatar, bio: newUser.bio, fullName: newUser.fullName,
            genre: newUser.genre, pays: newUser.pays,
            createdAt: newUser.createdAt, updatedAt: newUser.updatedAt
        };
        res.status(201).json({ success: true, message: 'User registered successfully.', user: userResponse });
    } catch (error) {
        console.error('Registration Error:', error);
        if (error.name === 'SequelizeValidationError') {
             return res.status(400).json({ success: false, message: 'Validation error.', errors: error.errors.map(e => ({ msg: e.message, path: e.path })) });
        }
        res.status(500).json({ success: false, message: 'An error occurred during registration.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// --- Fonction de Connexion (Login) ---
exports.login = async (req, res, next) => {
    // ... (code login existant avec logs - inchangé) ...
    console.log('--- Login attempt started ---');
    console.log('Request body:', req.body);
    const { email, password } = req.body;
    try {
        console.log(`[Login] Attempting to find user with email: ${email}`);
        const user = await User.findOne({ where: { email: email } });
        console.log('[Login] User.findOne completed.');
        if (!user) {
            console.log(`[Login] User not found for email: ${email}`);
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        console.log(`[Login] User found: ${user.id}`);
        console.log('[Login] Attempting to compare password...');
        let isMatch = false;
        try { isMatch = await bcrypt.compare(password, user.password); console.log('[Login] bcrypt.compare completed. Match:', isMatch); }
        catch(bcryptError) { console.error('[Login] Error during bcrypt.compare:', bcryptError); return res.status(500).json({ success: false, message: 'An internal error occurred during authentication.' }); }
        if (!isMatch) { console.log(`[Login] Password mismatch for user: ${user.id}`); return res.status(401).json({ success: false, message: 'Invalid credentials.' }); }
        console.log(`[Login] Password matched for user: ${user.id}`);
        console.log('[Login] Preparing JWT payload...');
        const payload = { user: { id: user.id } };
        const secret = process.env.JWT_SECRET;
        const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
        console.log(`[Login] JWT Secret check: ${secret ? 'Exists' : 'MISSING!'}`);
        if (!secret) { console.error("FATAL ERROR: JWT_SECRET is not defined!"); return res.status(500).json({ success: false, message: "Server configuration error (JWT Secret missing)."}); }
        console.log('[Login] Attempting to sign JWT...');
        jwt.sign( payload, secret, { expiresIn: expiresIn }, (err, token) => {
            console.log('[Login] Inside jwt.sign callback.');
            if (err) { console.error('JWT Signing Error:', err); return res.status(500).json({ success: false, message: 'Failed to generate authentication token.'}); }
            console.log('[Login] JWT signed successfully.');
            const userResponse = {
                id: user.id, username: user.username, email: user.email, avatar: user.avatar,
                bio: user.bio, fullName: user.fullName, genre: user.genre, pays: user.pays,
                createdAt: user.createdAt, updatedAt: user.updatedAt
            };
            console.log('[Login] User response prepared.');
            console.log('[Login] Sending success response...');
            res.status(200).json({ success: true, message: 'Login successful.', token: token, user: userResponse });
            console.log('[Login] Success response sent.');
        });
        console.log('[Login] After calling jwt.sign (callback is async).');
    } catch (error) {
        console.error('--- Login Controller General Error Catch ---');
        console.error(error);
        res.status(500).json({ success: false, message: 'An error occurred during login.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};


// --- Fonction pour récupérer l'utilisateur connecté ---
exports.getMe = async (req, res, next) => {
    // ... (code getMe existant - inchangé) ...
    try {
        if (!req.user || !req.user.id) { console.warn('User ID not found in req.user (getMe controller).'); return res.status(401).json({ status: 'fail', message: 'Unauthorized: Could not identify user.' }); }
        const userId = req.user.id;
        const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
        if (!user) { return res.status(404).json({ status: 'fail', message: 'User associated with this token not found.' }); }
        res.status(200).json({ status: 'success', data: { user: user } });
    } catch (error) {
        console.error('GetMe Error:', error);
        res.status(500).json({ status: 'error', message: 'An error occurred while fetching user profile.', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};


// --- AJOUT: Fonction pour mettre à jour l'utilisateur connecté ---
exports.updateMe = async (req, res, next) => {
    console.log('--- updateMe Controller Start ---');
    console.log('User ID from Auth:', req.user?.id); // ID de l'utilisateur authentifié
    console.log('Request Body (req.body):', req.body); // Données textuelles du formulaire (ou JSON)
    console.log('Request File (req.file):', req.file); // Infos sur le fichier uploadé par Multer

    // 1. Vérifier l'authentification (normalement déjà fait par middleware, mais sécurité)
    if (!req.user || !req.user.id) {
        console.warn('[UpdateMe] User ID manquant dans req.user');
        return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });
    }
    const userId = req.user.id;

    // 2. Filtrer les champs autorisés à la mise à jour depuis req.body
    const allowedUpdates = ['fullName', 'email', 'genre', 'pays', 'bio']; // Adapter cette liste
    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
            // Gérer la valeur null explicitement si '' est envoyé pour des champs optionnels comme genre/pays/bio
            if ((key === 'genre' || key === 'pays' || key === 'bio' || key === 'fullName') && req.body[key] === '') {
                 filteredBody[key] = null;
            } else {
                 filteredBody[key] = req.body[key];
            }
        }
    });
    console.log('[UpdateMe] Données filtrées pour la mise à jour (hors avatar):', filteredBody);

    // 3. Préparer le chemin du nouvel avatar si uploadé
    let newAvatarPath = null;
    if (req.file) {
        // Construire le chemin relatif accessible via le web
        // IMPORTANT: Adapte '/uploads/avatars/' au chemin que tu utilises réellement
        // pour servir tes fichiers statiques d'avatars.
        newAvatarPath = `/uploads/avatars/${req.file.filename}`;
        console.log('[UpdateMe] Nouveau chemin avatar préparé:', newAvatarPath);
    }

    // 4. Vérifier si des données (texte ou fichier) sont présentes pour la mise à jour
    if (Object.keys(filteredBody).length === 0 && !newAvatarPath) {
        console.log('[UpdateMe] Aucune donnée valide ou nouveau fichier à mettre à jour.');
        // Renvoyer un message indiquant qu'il n'y a rien à faire, ou juste les données actuelles
        try {
            const currentUser = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
            return res.status(200).json({
                status: 'success',
                message: 'Aucune modification détectée.',
                data: { user: currentUser }
            });
        } catch (fetchError) {
            // Gérer l'erreur si la récupération échoue aussi
            console.error('[UpdateMe] Erreur récupération utilisateur actuel après aucune modif détectée:', fetchError);
             return res.status(500).json({ status: 'error', message: 'Erreur serveur.'});
        }
    }

    try {
        // 5. Trouver l'utilisateur à mettre à jour
        console.log(`[UpdateMe] Recherche de l'utilisateur ID: ${userId}`);
        const user = await User.findByPk(userId);
        if (!user) {
            console.log('[UpdateMe] Utilisateur non trouvé pour mise à jour.');
            // Si un fichier a été uploadé mais l'utilisateur n'est pas trouvé, supprimer le fichier uploadé
            if (req.file) {
                await unlinkAsync(req.file.path).catch(err => console.error('[UpdateMe] Erreur suppression fichier uploadé (user non trouvé):', err));
            }
            return res.status(404).json({ status: 'fail', message: 'Utilisateur non trouvé.' });
        }
        console.log('[UpdateMe] Utilisateur trouvé.');

        // 6. Préparer les données finales pour la mise à jour (texte + avatar)
        const updateData = { ...filteredBody };
        let oldAvatarPath = user.avatar; // Stocker l'ancien chemin pour suppression éventuelle

        if (newAvatarPath) {
            updateData.avatar = newAvatarPath; // Ajouter le nouveau chemin avatar aux données à sauvegarder
        }

        // 7. Appliquer et sauvegarder les modifications
        console.log('[UpdateMe] Application des modifications:', updateData);
        Object.assign(user, updateData); // Applique les changements à l'instance Sequelize
        await user.save(); // Sauvegarde dans la base de données
        console.log('[UpdateMe] Utilisateur mis à jour avec succès dans la DB.');

        // 8. Supprimer l'ancien avatar du système de fichiers (si un nouveau a été uploadé et l'ancien existait)
        if (newAvatarPath && oldAvatarPath) {
            console.log(`[UpdateMe] Tentative de suppression de l'ancien avatar: ${oldAvatarPath}`);
            // Construire le chemin absolu vers l'ancien fichier dans le dossier 'public' (ou équivalent)
            // IMPORTANT: Adapte `__dirname, '..', 'public'` à ta structure de projet
            const absoluteOldPath = path.join(__dirname, '..', 'public', oldAvatarPath);
            console.log(`[UpdateMe] Chemin absolu ancien avatar: ${absoluteOldPath}`);
            await unlinkAsync(absoluteOldPath).catch(err => {
                // Log l'erreur mais ne bloque pas la réponse succès si la suppression échoue
                console.error(`[UpdateMe] Erreur lors de la suppression de l'ancien avatar (${absoluteOldPath}):`, err.code === 'ENOENT' ? 'Fichier non trouvé' : err.message);
            });
        }

        // 9. Renvoyer une réponse succès avec l'utilisateur mis à jour
        const updatedUserResponse = { ...user.toJSON() }; // Convertir en objet simple
        delete updatedUserResponse.password; // Toujours exclure le mot de passe

        res.status(200).json({
            status: 'success',
            message: 'Profil mis à jour avec succès.',
            data: {
                user: updatedUserResponse
            }
        });
        console.log('--- updateMe Controller End (Success) ---');

    } catch (error) {
        console.error('--- updateMe Controller ERROR ---');
        console.error(error);

        // Si une nouvelle image a été uploadée mais la sauvegarde DB a échoué, supprimer la nouvelle image
        if (req.file) {
            console.warn('[UpdateMe] Erreur lors de la sauvegarde DB, suppression du fichier uploadé:', req.file.path);
            await unlinkAsync(req.file.path).catch(err => console.error('[UpdateMe] Erreur suppression fichier uploadé (échec sauvegarde DB):', err));
        }

        // Gestion spécifique des erreurs Sequelize
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                status: 'fail',
                message: error.errors?.map(e => e.message).join(', ') || 'Erreur de validation.',
                errors: error.errors?.map(e => ({ field: e.path, message: e.message })) // Plus détaillé si possible
            });
        }

        // Erreur serveur générique
        res.status(500).json({
            status: 'error',
            message: 'Une erreur est survenue lors de la mise à jour du profil.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};