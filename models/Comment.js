'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Comment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Un commentaire appartient à un utilisateur
      Comment.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
      // Un commentaire appartient à une note vocale
      Comment.belongsTo(models.VoiceNote, {
        foreignKey: 'voice_note_id',
        as: 'voiceNote',
      });
    }
  }
  Comment.init({
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
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    voice_note_id: { // Clé étrangère
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'voice_notes',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false, // Le texte est requis (sauf si audio_url est fourni ?) - A adapter selon la logique métier
    },
    audio_url: {
      type: DataTypes.STRING,
      allowNull: true, // Optionnel
      validate: {
        isUrl: true,
      },
    },
    // createdAt et updatedAt gérés par Sequelize
  }, {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    timestamps: true,
    underscored: true,
  });
  return Comment;
};