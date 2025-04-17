// models/user.js
'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Associations existantes...
      User.hasMany(models.VoiceNote, {
        foreignKey: 'user_id',
        as: 'voiceNotes',
      });
      User.hasMany(models.Reaction, {
        foreignKey: 'user_id',
        as: 'reactions',
      });
      User.hasMany(models.Comment, {
        foreignKey: 'user_id',
        as: 'comments',
      });
      User.hasMany(models.Share, {
        foreignKey: 'user_id',
        as: 'shares',
      });
      User.hasMany(models.Report, { 
        foreignKey: 'user_id',
        as: 'reports', 
      });
      User.belongsToMany(models.Conversation, {
        through: 'conversation_participants',
        foreignKey: 'user_id', 
        otherKey: 'conversation_id',
        as: 'conversations',
      });

      // Un utilisateur envoie plusieurs messages
      User.hasMany(models.Message, {
        foreignKey: 'sender_id',
        as: 'sentMessages',
      });
       
    }
  }
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'full_name',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    genre: {
      type: DataTypes.ENUM('homme', 'femme', 'autre', 'prefer_not_say'),
      allowNull: true,
    },
    pays: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, 
      field: 'is_admin',   
    },
    isActive: {
     type: DataTypes.BOOLEAN,
     allowNull: false,
     defaultValue: true, 
     field: 'is_active',   
   },
   

  }, {
    // Options du modèle
    sequelize,          
    modelName: 'User',  
    tableName: 'users', 
    timestamps: true,   
    underscored: true,  
  });
  return User;
};