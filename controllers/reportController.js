// controllers/reportController.js (Adapté pour snake_case)
'use strict';

// Importer les modèles nécessaires
const { Report, VoiceNote, User, Sequelize } = require('../models'); // Ajout Sequelize pour Op
const Op = Sequelize.Op;

// === Créer un nouveau signalement ===
exports.createReport = async (req, res, next) => {
  console.log("[CreateReport] Request received. Body:", req.body, "User:", req.user?.id);
  try {
    const { voiceNoteId, reason } = req.body;
    const userId = req.user?.id; // ID de l'utilisateur qui signale

    // --- Validations ---
    if (!userId) {
        return res.status(401).json({ status: 'fail', message: 'Authentification requise.' });
    }
    if (!voiceNoteId) {
        return res.status(400).json({ status: 'fail', message: 'L\'ID de la note vocale est requis (voiceNoteId).' });
    }
    if (!reason || reason.trim().length < 5) { // Minimum 5 caractères pour la raison
        return res.status(400).json({ status: 'fail', message: 'La raison du signalement doit contenir au moins 5 caractères.' });
    }

    // Vérifier si la VoiceNote existe
    const voiceNote = await VoiceNote.findByPk(voiceNoteId, { attributes: ['id'] }); // Léger
    if (!voiceNote) {
      return res.status(404).json({ status: 'fail', message: 'La note vocale spécifiée n\'existe pas.' });
    }

    // Vérifier si cet utilisateur a déjà signalé cette note (et que ce n'est pas rejeté)
    const existingReport = await Report.findOne({
      where: {
        user_id: userId,          // Utilisation de user_id
        voice_note_id: voiceNoteId, // Utilisation de voice_note_id
        status: { [Op.ne]: 'rejected' } // Ne pas re-signaler si déjà traité sauf si rejeté
      }
    });

    if (existingReport) {
      // Message plus informatif
      return res.status(409).json({ status: 'fail', message: `Vous avez déjà un signalement ${existingReport.status === 'pending' ? 'en attente' : 'existant'} pour cette note.` });
    }

    // Créer le signalement en utilisant les noms de colonnes snake_case
    const report = await Report.create({
      user_id: userId,          // Correspond à la colonne DB
      voice_note_id: voiceNoteId, // Correspond à la colonne DB
      reason: reason,
      // 'status' prendra sa valeur par défaut ('pending') définie dans le modèle
    });
    console.log(`[CreateReport] Report created with ID: ${report.id}`);

    // Pas besoin de recharger ici, on renvoie juste le succès
    res.status(201).json({
        status: 'success',
        message: 'Signalement enregistré avec succès.', // Ajouter un message
        data: {
            report: report.toJSON() // Renvoyer le rapport créé (toJSON est une bonne pratique)
        }
    });
  } catch (error) {
     console.error("[CreateReport] Error:", error);
     if (error.name === 'SequelizeValidationError') {
         return res.status(400).json({ status: 'fail', message: error.errors.map(e => e.message).join(', ') });
     }
     // Gérer spécifiquement les erreurs de clé étrangère si besoin
     if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error("[CreateReport] ForeignKey Constraint Error:", error.parent?.sqlMessage || error.message);
        return res.status(400).json({ status: 'fail', message: 'ID utilisateur ou note vocale invalide.' });
     }
    next(error); // Gestion globale
  }
};








// === Obtenir la liste des signalements (Admin) ===
exports.getReports = async (req, res, next) => {
  console.log("[getReports] Admin request received. Query:", req.query);
  try {
    // La vérification isAdmin est faite par le middleware sur la route

    const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = req.query; // Ajout tri
    const where = {};

    // Filtrage par statut
    const validStatuses = Report.getAttributes().status.values; // Récupère les ENUM du modèle
    if (status && validStatuses.includes(status)) {
      where.status = status;
    } else if (status) {
        return res.status(400).json({ status: 'fail', message: `Statut de filtre invalide: ${status}.` });
    }

    // Options de tri
    const orderClause = [];
    // Mappage des noms de tri frontend vers les noms de colonnes DB/modèle
    const sortMapping = { createdAt: 'created_at', status: 'status' };
    const sortField = sortMapping[sortBy] || 'created_at'; // Défaut à created_at
    const sortDirection = ['ASC', 'DESC'].includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
    orderClause.push([sortField, sortDirection]);
    // Ajouter un tri secondaire par ID pour la stabilité
    if (sortField !== 'id') {
        orderClause.push(['id', 'DESC']);
    }


    // Calcul de l'offset
    const offset = (page - 1) * limit;

    // Récupérer les signalements avec pagination, tri et détails associés
    const { count, rows: reports } = await Report.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'reporter', // Vérifier cet alias dans Report.associate
          attributes: ['id', 'username', 'avatar'] // Exclure email si non nécessaire
        },
        {
          model: VoiceNote,
          as: 'reportedVoiceNote', // Vérifier cet alias
          attributes: ['id', 'description', 'audio_url', 'user_id'], // Ajouter user_id de la note
          required: false, // Garder le rapport même si la note a été supprimée ? (ou mettre true pour exclure)
          include: [ // Inclure le créateur de la note signalée
            {
              model: User,
              as: 'user', // Vérifier l'alias User dans VoiceNote.associate
              attributes: ['id', 'username', 'avatar']
            }
          ]
        },
        // Inclure d'autres éléments si nécessaire (ex: Comment si on signale des commentaires)
      ],
      order: orderClause, // Appliquer le tri
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      distinct: true // Peut être nécessaire avec include hasMany
    });
     console.log(`[getReports] Found ${count} reports, returning ${reports.length} for page ${page}.`);

    res.status(200).json({
      status: 'success',
      results: reports.length,
      totalReports: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
      data: {
        reports: reports.map(r => r.toJSON()) // Utiliser toJSON()
      }
    });
  } catch (error) {
    console.error("[getReports] Error:", error);
    next(error);
  }
};


// === Mettre à jour un signalement (Admin) ===
exports.updateReport = async (req, res, next) => {
   const reportId = req.params.id; // ID du rapport
   const adminUserId = req.user.id; // ID de l'admin
   const { status, resolution } = req.body; // Nouvelles valeurs
   console.log(`[updateReport] Admin ${adminUserId} updating report ${reportId}. Body:`, req.body);

  try {
    // La vérification isAdmin est faite par le middleware

    // Valider le statut fourni (récupère les valeurs ENUM du modèle)
    const validStatuses = Report.getAttributes().status.values;
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ status: 'fail', message: `Statut invalide: ${status}.` });
    }
    // Valider la résolution si le statut est final
    if (['resolved', 'rejected'].includes(status) && (!resolution || String(resolution).trim() === '')) {
        return res.status(400).json({ status: 'fail', message: 'Une note de résolution est requise pour ce statut.' });
    }

    // Trouver le rapport
    const report = await Report.findByPk(reportId);
    if (!report) { return res.status(404).json({ status: 'fail', message: 'Signalement non trouvé.' }); }

    // Préparer les données de mise à jour
    const updateData = {};
    if (status) updateData.status = status;
    // Mettre à jour 'resolution' seulement s'il est fourni (permet de l'effacer avec null ou "")
    if (resolution !== undefined) updateData.resolution = resolution;

    // Si le statut change vers un état final, enregistrer l'admin et la date
    // Utiliser les noms de colonnes snake_case
    if (['resolved', 'rejected'].includes(status) && report.status !== status) {
        updateData.resolved_by_id = adminUserId; // Nom de colonne DB
        updateData.resolved_at = new Date();   // Nom de colonne DB
    }

    // Effectuer la mise à jour
    const [numberOfAffectedRows] = await Report.update(updateData, {
        where: { id: reportId },
        // returning: true, // Peut être utile avec certains dialectes pour récupérer l'objet mis à jour
    });

    if (numberOfAffectedRows === 0) {
         // Ne devrait pas arriver si findByPk a fonctionné, mais sécurité
         return res.status(404).json({ status: 'fail', message: 'Signalement non trouvé lors de la mise à jour.' });
    }

    console.log(`[updateReport] Report ${reportId} updated.`);

    // Recharger le rapport mis à jour pour la réponse
     const updatedReport = await Report.findByPk(reportId, {
         include: [ // Inclure les mêmes associations que getReports pour la cohérence
            { model: User, as: 'reporter', attributes: ['id', 'username', 'avatar'] },
            { model: VoiceNote, as: 'reportedVoiceNote', include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }] },
            // { model: User, as: 'resolvedBy', attributes: ['id', 'username'] } // Ajout pour voir qui a résolu
         ]
     });

    res.status(200).json({
        status: 'success',
        message: 'Signalement mis à jour.', // Ajouter message
        data: {
            report: updatedReport ? updatedReport.toJSON() : null // Renvoyer la version à jour
        }
    });
  } catch (error) {
     console.error(`[updateReport] Error updating report ${reportId}:`, error);
     if (error.name === 'SequelizeValidationError') {
         return res.status(400).json({ status: 'fail', message: error.errors.map(e => e.message).join(', ') });
     }
    next(error);
  }
};
