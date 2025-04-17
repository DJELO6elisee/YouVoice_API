'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Share extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Un partage appartient à un utilisateur (celui qui partage)
      Share.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
      // Un partage concerne une note vocale
      Share.belongsTo(models.VoiceNote, {
        foreignKey: 'voice_note_id',
        as: 'voiceNote',
      });
    }
  }
  Share.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: { // Clé étrangère (qui partage)
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
    shared_to: {
      type: DataTypes.STRING,
      allowNull: false, 
      comment: 'Ex: facebook, twitter, whatsapp, ou user UUID'
    },
    // createdAt géré par Sequelize
  }, {
    sequelize,
    modelName: 'Share',
    tableName: 'shares',
    timestamps: true, 
    updatedAt: false,
    underscored: true,
  });
  return Share;
};