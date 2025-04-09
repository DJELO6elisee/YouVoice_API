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
      User.hasMany(models.Report, { // Assurez-vous que le modèle Report existe
        foreignKey: 'user_id',
        as: 'reports', // Signalements faits par cet utilisateur
      });
       // Si un Report peut concerner un User (ex: signaler un utilisateur)
       // User.hasMany(models.Report, { foreignKey: 'reported_user_id', as: 'reportedAgainst' });
    }
  }
  User.init({
    // --- Champs Existants ---
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

    // ====> CHAMPS AJOUTÉS (Maintenant à l'intérieur de l'objet init) <====
    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Très important pour la sécurité
      field: 'is_admin',   // Nom de colonne snake_case
    },
    isActive: {
     type: DataTypes.BOOLEAN,
     allowNull: false,
     defaultValue: true, // Actif par défaut
     field: 'is_active',   // Nom de colonne snake_case
   },
   // ====> FIN DES CHAMPS AJOUTÉS <====

    // createdAt et updatedAt sont ajoutés automatiquement par timestamps: true
    // mais sont définis implicitement avec les colonnes created_at et updated_at
    // à cause de underscored: true

  }, {
    // Options du modèle
    sequelize,          // Instance Sequelize
    modelName: 'User',  // Nom du modèle en CamelCase
    tableName: 'users', // Nom de la table en snake_case
    timestamps: true,   // Ajoute createdAt et updatedAt
    underscored: true,  // Utilise snake_case pour les clés étrangères et les noms de champs (ex: isAdmin -> is_admin)
  });
  return User;
};