const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Chemins des Dossiers ---
// Crée les dossiers nécessaires s'ils n'existent pas
const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath); // Récupère le dossier parent
  if (fs.existsSync(dirname)) {
    return true;
  }
  console.log(`Création du dossier manquant : ${dirname}`);
  try {
      fs.mkdirSync(dirname, { recursive: true }); // Crée récursivement
      return true;
  } catch (err) {
       console.error(`Erreur lors de la création du dossier ${dirname}:`, err);
       return false;
  }
};

const publicDir = path.join(__dirname, '..', 'public'); // Chemin vers le dossier public
const avatarsDir = path.join(publicDir, 'uploads', 'avatars'); // Sous-dossier pour avatars
const voiceNotesDir = path.join(publicDir, 'uploads', 'voice_notes'); // Sous-dossier pour notes vocales

// S'assurer que les dossiers existent au démarrage
ensureDirectoryExistence(path.join(avatarsDir, 'placeholder.txt')); // Crée avatarsDir si besoin
ensureDirectoryExistence(path.join(voiceNotesDir, 'placeholder.txt')); // Crée voiceNotesDir si besoin

// --- Configuration pour les AVATARS (Images) ---
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir); // Enregistrer dans /public/uploads/avatars
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // Nom fichier: avatar-suffixe_unique.ext
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

const avatarFileFilter = (req, file, cb) => {
  // Autoriser seulement les images
  if (file.mimetype.startsWith('image/')) {
    console.log(`[Avatar Upload Filter] Type ${file.mimetype} autorisé.`);
    cb(null, true);
  } else {
    console.warn(`[Avatar Upload Filter] Type ${file.mimetype} rejeté.`);
    const err = new Error('Seuls les fichiers image sont autorisés !');
    err.status = 400;
    cb(err, false);
  }
};

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite à 5MB pour les avatars
  }
});

// --- Configuration pour les NOTES VOCALES (Audio) ---
const voiceNoteStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, voiceNotesDir); // Enregistrer dans /public/uploads/voice_notes
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname); // Garde l'extension originale (ex: .webm)
    // Nom fichier: note-suffixe_unique.ext
    cb(null, 'note-' + uniqueSuffix + ext);
  }
});

const voiceNoteFileFilter = (req, file, cb) => {
  // Autoriser seulement les types audio courants (ajuste si nécessaire)
  const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/aac'];
   // Ou vérifier les extensions si mime types non fiables
   // const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac'];
   // const ext = path.extname(file.originalname).toLowerCase();

  console.log(`[VoiceNote Upload Filter] Checking file: ${file.originalname}, mimetype: ${file.mimetype}`);

  if (allowedMimeTypes.includes(file.mimetype)) {
     console.log(`[VoiceNote Upload Filter] Mimetype ${file.mimetype} autorisé.`);
    cb(null, true); // Accepter le fichier
  } else {
    console.warn(`[VoiceNote Upload Filter] Mimetype ${file.mimetype} rejeté.`);
    const err = new Error(`Type de fichier audio non autorisé (${file.mimetype}).`);
    err.status = 400; // Code d'erreur Bad Request
    cb(err, false);
  }
};

const uploadVoiceNote = multer({
  storage: voiceNoteStorage,
  fileFilter: voiceNoteFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite à 10MB pour les notes vocales (ajuste)
    files: 1 // Généralement une note à la fois
  }
});

// --- Exporter les deux configurations ---
module.exports = {
  uploadAvatar,
  uploadVoiceNote
};