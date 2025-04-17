'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Conversation extends Model {
    static associate(models) {
      // Une conversation appartient à plusieurs utilisateurs (participants)
      Conversation.belongsToMany(models.User, {
        through: 'conversation_participants', // Table de jonction
        foreignKey: 'conversation_id',       // Clé dans la table de jonction pointant vers Conversation
        otherKey: 'user_id',               // Clé dans la table de jonction pointant vers User
        as: 'participants',
      });

      // Une conversation a plusieurs messages
      Conversation.hasMany(models.Message, {
        foreignKey: 'conversation_id',
        as: 'messages',
        onDelete: 'CASCADE',
      });

      // Une conversation peut avoir un dernier message (pour aperçu rapide)
      Conversation.belongsTo(models.Message, {
        foreignKey: 'last_message_id',
        as: 'lastMessage',
        constraints: false,
        allowNull: true,
      });
    }
  }
  Conversation.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: { 
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_group: { 
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_message_id: { 
      type: DataTypes.UUID,
      allowNull: true,
      
    },
  }, {
    sequelize,
    modelName: 'Conversation',
    tableName: 'conversations',
    timestamps: true,
    underscored: true,
  });
  return Conversation;
};