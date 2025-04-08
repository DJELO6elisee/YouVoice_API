'use strict';

// Importer les modèles nécessaires (ajout de User)
const { Report, VoiceNote, User } = require('../models'); 
const { Op } = require('sequelize'); // Importer Op pour les requêtes plus complexes si besoin

// === Créer un nouveau signalement ===
exports.createReport = async (req, res, next) => {
  try {
    const { voiceNoteId, reason } = req.body;
    const reporterId = req.user.id; // ID de l'utilisateur qui signale

    // TODO (Recommandation): Valider les entrées (présence/longueur de reason, format voiceNoteId)

    if (!reason || reason.trim().length < 10) { // Exemple de validation simple
        return res.status(400).json({ status: 'fail', message: 'La raison du signalement doit contenir au moins 10 caractères.' });
    }
    if (!voiceNoteId) {
        return res.status(400).json({ status: 'fail', message: 'L\'ID de la note vocale est requis.' });
    }

    // Vérifier si la VoiceNote existe
    const voiceNote = await VoiceNote.findByPk(voiceNoteId);
    if (!voiceNote) {
      return res.status(404).json({ status: 'fail', message: 'La note vocale spécifiée n\'existe pas.' });
    }

    // Correction: Utiliser reporterId pour vérifier les doublons
    const existingReport = await Report.findOne({
      where: { 
        reporterId: reporterId, 
        voiceNoteId: voiceNoteId,
        status: { [Op.ne]: 'rejected' } // Optionnel: Autoriser un nouveau rapport si le précédent a été rejeté ? À discuter.
      }
    });

    if (existingReport) {
      return res.status(409).json({ status: 'fail', message: 'Vous avez déjà signalé cette note vocale.' }); // 409 Conflict est plus approprié
    }

    // Correction: Utiliser reporterId lors de la création
    const report = await Report.create({
      reporterId: reporterId, // Utiliser reporterId
      voiceNoteId: voiceNoteId,
      reason: reason,
      // Le statut par défaut 'pending' sera appliqué par le modèle
    });

    // Optionnel: Recharger pour inclure des infos si besoin, sinon renvoyer direct
    // const reportWithDetails = await Report.findByPk(report.id, { include: [...] });

    res.status(201).json({
        status: 'success',
        data: {
            report // Renvoyer le rapport créé
        }
    });
  } catch (error) {
     if (error.name === 'SequelizeValidationError') {
         return res.status(400).json({ status: 'fail', message: error.errors.map(e => e.message).join(', ') });
     }
    next(error); // Gestion globale
  }
};

// === Obtenir la liste des signalements (Admin) ===
exports.getReports = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ status: 'fail', message: 'Accès non autorisé. Réservé aux administrateurs.' });
    }

    const { status, page = 1, limit = 10 } = req.query; // Ajout de pagination simple
    const where = {};
    
    // Filtrage par statut (s'assurer que le statut est valide)
    const validStatuses = ['pending', 'under_review', 'resolved', 'rejected'];
    if (status && validStatuses.includes(status)) {
      where.status = status;
    } else if (status) {
        return res.status(400).json({ status: 'fail', message: `Statut de filtre invalide: ${status}. Utilisez l'un des suivants: ${validStatuses.join(', ')}` });
    }

    // Calcul de l'offset pour la pagination
    const offset = (page - 1) * limit;

    // Récupérer les signalements avec les détails associés et pagination
    const { count, rows: reports } = await Report.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'reporter', // Alias correct
          attributes: ['id', 'username', 'avatar', 'email'] // Ajouter email si utile pour l'admin
        },
        { 
          model: VoiceNote, 
          as: 'reportedVoiceNote', // Correction: Alias correct
          include: [ // Include imbriqué
            { 
              model: User, 
              as: 'creator', // Correction: Alias correct pour le créateur de la note
              attributes: ['id', 'username', 'avatar', 'email'] // Ajouter email si utile pour l'admin
            }
          ]
        },
        {
            model: User,
            as: 'resolvedBy', // Inclure l'admin qui a résolu (peut être null)
            attributes: ['id', 'username']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10), // Convertir en nombre
      offset: parseInt(offset, 10) // Convertir en nombre
    });

    res.status(200).json({
      status: 'success',
      results: reports.length,
      totalReports: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
      data: {
        reports 
      }
    });
  } catch (error) {
    next(error);
  }
};

// === Mettre à jour un signalement (Admin) ===
exports.updateReport = async (req, res, next) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ status: 'fail', message: 'Accès non autorisé. Réservé aux administrateurs.' });
    }

    const { status, resolution } = req.body;
    const { id } = req.params; // ID du rapport à mettre à jour

    // Valider le statut fourni
    const validStatuses = ['pending', 'under_review', 'resolved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ status: 'fail', message: `Statut invalide: ${status}. Utilisez l'un des suivants: ${validStatuses.join(', ')}` });
    }
    // Valider la résolution si le statut est final
    if (['resolved', 'rejected'].includes(status) && (!resolution || resolution.trim() === '')) {
        return res.status(400).json({ status: 'fail', message: 'Une résolution est requise lorsque le statut est "resolved" ou "rejected".' });
    }


    // Trouver le rapport à mettre à jour
    const report = await Report.findByPk(id);

    if (!report) {
      return res.status(404).json({ status: 'fail', message: 'Signalement non trouvé.' });
    }

    // Préparer les données de mise à jour
    const updateData = {};
    if (status) {
        updateData.status = status;
    }
    if (resolution !== undefined) { // Permettre de mettre à jour/vider la résolution
        updateData.resolution = resolution;
    }

    // Si le statut est mis à jour vers un état final, enregistrer qui l'a fait et quand
    if (['resolved', 'rejected'].includes(status) && report.status !== status) {
        updateData.resolvedById = req.user.id; // ID de l'admin actuel
        updateData.resolvedAt = new Date();   // Date/heure actuelle
    }

    // Effectuer la mise à jour
    await report.update(updateData);

    // Recharger le rapport avec les associations pour la réponse (optionnel mais propre)
     const updatedReport = await Report.findByPk(id, {
         include: [
            { model: User, as: 'reporter', attributes: ['id', 'username', 'avatar'] },
            { model: VoiceNote, as: 'reportedVoiceNote'}, // Inclure la note signalée
            { model: User, as: 'resolvedBy', attributes: ['id', 'username'] } // Inclure l'admin résolveur
         ]
     });

    res.status(200).json({
        status: 'success',
        data: {
            report: updatedReport
        }
    });
  } catch (error) {
     if (error.name === 'SequelizeValidationError') {
         return res.status(400).json({ status: 'fail', message: error.errors.map(e => e.message).join(', ') });
     }
    next(error);
  }
};