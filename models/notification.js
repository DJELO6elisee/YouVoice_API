// models/notification.js
'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Notification extends Model {
    static associate(models) {
      // Qui reçoit la notification
      Notification.belongsTo(models.User, {
        foreignKey: 'recipientUserId', // Clé étrangère dans Notification
        as: 'recipient',          // Alias pour accéder à l'utilisateur destinataire
      });

      // Qui a déclenché la notification (peut être null si système)
      Notification.belongsTo(models.User, {
        foreignKey: 'actorUserId',     // Clé étrangère dans Notification
        as: 'actor',              // Alias pour accéder à l'utilisateur acteur
        required: false,          // Une notification système n'a pas d'acteur
      });

      // La note vocale concernée (si applicable)
      Notification.belongsTo(models.VoiceNote, {
        foreignKey: 'voiceNoteId',   // Clé étrangère dans Notification
        as: 'voiceNote',          // Alias
        required: false,          // Pas toutes les notifs concernent une note
      });

       // Le commentaire concerné (si applicable)
       Notification.belongsTo(models.Comment, {
        foreignKey: 'commentId',     // Clé étrangère dans Notification
        as: 'comment',            // Alias
        required: false,          // Seulement pour notifs de commentaire
      });

       // La réaction concernée (si applicable)
       Notification.belongsTo(models.Reaction, {
        foreignKey: 'reactionId',   // Clé étrangère dans Notification
        as: 'reaction',          // Alias
        required: false,          // Seulement pour notifs de réaction
      });

       // Le partage concerné (si applicable)
       Notification.belongsTo(models.Share, {
        foreignKey: 'shareId',      // Clé étrangère dans Notification
        as: 'share',             // Alias
        required: false,          // Seulement pour notifs de partage
      });

      // TODO: Ajouter d'autres associations si nécessaire (ex: Follow)
    }
  }
  Notification.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    recipientUserId: { // Qui est notifié
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // Supprime les notifs si l'utilisateur est supprimé
    },
    actorUserId: { // Qui a fait l'action (peut être null)
      type: DataTypes.UUID,
      allowNull: true, // Permet les notifications système
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Garde la notif mais sans acteur si l'acteur est suppr.
    },
    type: { // Type de notification
      type: DataTypes.ENUM(
          'like',        // Quelqu'un a aimé votre note
          'comment',     // Quelqu'un a commenté votre note
          'share',       // Quelqu'un a partagé votre note
          'follow',      // Quelqu'un vous a suivi (pas lié à une note)
          'mention',     // Quelqu'un vous a mentionné dans un commentaire (avancé)
          'system'       // Notification système générale
          // Ajoutez d'autres types si besoin
       ),
      allowNull: false,
    },
    read: { // Statut de lecture
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Non lue par défaut
    },
    // Clés étrangères vers les objets concernés (optionnelles)
    voiceNoteId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'voice_notes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // Si la note est supprimée, la notif associée l'est aussi
    },
    commentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'comments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    reactionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'reactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
    shareId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'shares', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
    // createdAt et updatedAt gérés par Sequelize
  }, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true, // Garder createdAt et updatedAt
    underscored: true,
    // Ajouter des index pour améliorer les requêtes fréquentes
    indexes: [
        { fields: ['recipient_user_id', 'read', 'created_at'] }, // Pour récupérer les notifs non lues d'un user
        { fields: ['recipient_user_id', 'created_at'] }        // Pour récupérer toutes les notifs d'un user
    ]
  });
  return Notification;
};