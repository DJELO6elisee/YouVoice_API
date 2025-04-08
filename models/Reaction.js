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
        // Optionnel: Valider que c'est bien un emoji standard si nécessaire
        // is: /^\p{Emoji}$/u // Exemple de regex (peut nécessiter des ajustements)
      }
    },
    // createdAt géré par Sequelize (pas besoin d'updatedAt pour une réaction simple)
    // La colonne `updated_at` doit exister dans la BDD à cause de timestamps:true
  }, {
    sequelize,
    modelName: 'Reaction',
    tableName: 'reactions',
    timestamps: true, // Active createdAt et updatedAt (Sequelize s'attend aux deux colonnes en BDD)
    updatedAt: false, // Désactive la gestion de la valeur de updatedAt par Sequelize
    underscored: true, // Traduit camelCase en snake_case pour les colonnes BDD
    // Optionnel: Ajouter un index unique pour empêcher un utilisateur de réagir plusieurs fois avec le même emoji à la même note
    // indexes: [
    //   {
    //     unique: true,
    //     fields: ['user_id', 'voice_note_id', 'emoji'] // Ou juste user_id et voice_note_id si un user ne peut réagir qu'une fois
    //   }
    // ]
  });
  return Reaction;
};