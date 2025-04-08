'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class VoiceNote extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Une note vocale appartient à un utilisateur
      VoiceNote.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user', // Alias pour accéder à l'utilisateur depuis la note
      });
      // Une note vocale peut avoir plusieurs réactions
      VoiceNote.hasMany(models.Reaction, {
        foreignKey: 'voice_note_id',
        as: 'reactions',
        onDelete: 'CASCADE', // Supprime les réactions si la note est supprimée
      });
      // Une note vocale peut avoir plusieurs commentaires
      VoiceNote.hasMany(models.Comment, {
        foreignKey: 'voice_note_id',
        as: 'comments',
        onDelete: 'CASCADE', // Supprime les commentaires si la note est supprimée
      });
      // Une note vocale peut être partagée plusieurs fois
      VoiceNote.hasMany(models.Share, {
        foreignKey: 'voice_note_id',
        as: 'shares',
        onDelete: 'CASCADE', // Supprime les partages si la note est supprimée
      });
      // Une note vocale peut avoir plusieurs signalements
      VoiceNote.hasMany(models.Report, {
        foreignKey: 'voice_note_id',
        as: 'reports',
        onDelete: 'CASCADE', // Supprime les signalements si la note est supprimée
      });
    }
  }
  VoiceNote.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: { // Clé étrangère
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', // Nom de la table référencée
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // Ou 'SET NULL' si on veut garder l'utilisateur
    },
    audio_url: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
      },
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 60, // Durée max 60 secondes
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true, // Optionnel
    },
    // createdAt et updatedAt gérés par Sequelize
  }, {
    sequelize,
    modelName: 'VoiceNote',
    tableName: 'voice_notes',
    timestamps: true,
    underscored: true,
  });
  return VoiceNote;
};