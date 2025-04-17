'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Report extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Un signalement est fait par un utilisateur
      Report.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'reporter', // Alias pour l'utilisateur qui signale
      });
      // Un signalement concerne une note vocale
      Report.belongsTo(models.VoiceNote, {
        foreignKey: 'voice_note_id',
        as: 'reportedVoiceNote', // Alias pour la note signalée
      });
    }
  }
  Report.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: { // Clé étrangère (qui signale)
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', 
    },
    voice_note_id: { 
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'voice_notes',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', 
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false, 
    },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'resolved'),
      allowNull: false,
      defaultValue: 'pending',
    },
    // createdAt géré par Sequelize (updatedAt pourrait être utile ici si le statut change)
  }, {
    sequelize,
    modelName: 'Report',
    tableName: 'reports',
    timestamps: true, 
    underscored: true,
    
  });
  return Report;
};