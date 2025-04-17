'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Reaction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Une réaction appartient à un utilisateur
      Reaction.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
      // Une réaction appartient à une note vocale
      Reaction.belongsTo(models.VoiceNote, {
        foreignKey: 'voice_note_id',
        as: 'voiceNote',
      });
    }
  }
  Reaction.init({
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
    emoji: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        
      }
    },
    
  }, {
    sequelize,
    modelName: 'Reaction',
    tableName: 'reactions',
    timestamps: true,
    updatedAt: false,
    underscored: true, 
   
  });
  return Reaction;
};