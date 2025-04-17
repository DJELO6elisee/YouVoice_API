'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Message extends Model {
    static associate(models) {
      // Un message appartient à une conversation
      Message.belongsTo(models.Conversation, {
        foreignKey: 'conversation_id',
        as: 'conversation',
        onDelete: 'CASCADE',
      });

      // Un message est envoyé par un utilisateur
      Message.belongsTo(models.User, {
        foreignKey: 'sender_id',
        as: 'sender',
        onDelete: 'CASCADE',
      });

    }
  }
  Message.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conversations', 
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', 
        key: 'id',
      },
      onDelete: 'CASCADE', 
    },
    content: {
      type: DataTypes.TEXT, 
      allowNull: false,
    },
    
  }, {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    timestamps: true,
    underscored: true,
  });
  return Message;
};