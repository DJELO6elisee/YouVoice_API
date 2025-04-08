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
    }
  }
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    // Champ existant, peut-être moins utilisé si fullName est privilégié pour l'affichage
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // NOUVEAU: Nom complet de l'utilisateur
    fullName: {
      type: DataTypes.STRING,
      allowNull: true, // Ou false si vous voulez le rendre obligatoire
      field: 'full_name', // Nom explicite en snake_case pour la BDD (optionnel si underscored: true)
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
      type: DataTypes.STRING, // URL ou chemin du fichier
      allowNull: true,
      validate: {
         // isUrl: true, // Décommentez si vous stockez toujours des URL complètes
      },
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // NOUVEAU: Genre de l'utilisateur
    genre: {
      // Utilisation de ENUM pour restreindre les valeurs possibles
      type: DataTypes.ENUM('homme', 'femme', 'autre', 'prefer_not_say'),
      allowNull: true, // Permettre de ne pas spécifier
    },
    // NOUVEAU: Pays de l'utilisateur
    pays: {
      type: DataTypes.STRING, // Ou potentiellement un code pays (ex: FR, US, CI)
      allowNull: true, // Permettre de ne pas spécifier
    },
    // createdAt et updatedAt sont gérés automatiquement par Sequelize
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true, // Important: ceci transforme fullName en full_name, nickName en nick_name etc. dans la BDD
  });
  return User;
};