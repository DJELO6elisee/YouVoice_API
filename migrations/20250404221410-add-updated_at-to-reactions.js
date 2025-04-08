'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Commandes pour ajouter la colonne updated_at à la table reactions.
     */
    await queryInterface.addColumn(
      'reactions', // Nom de la table
      'updated_at', // Nom de la nouvelle colonne
      {
        type: Sequelize.DATE, // Type de données (cohérent avec created_at)
        allowNull: true // Permettre les NULLs, car elle n'était pas gérée avant et updatedAt:false dans le modèle
        // Pas besoin de defaultValue si allowNull: true et updatedAt: false
      }
    );
  },

  async down (queryInterface, Sequelize) {
    /**
     * Commandes pour annuler l'ajout (supprimer la colonne).
     */
    await queryInterface.removeColumn(
      'reactions', // Nom de la table
      'updated_at' // Nom de la colonne à supprimer
    );
  }
};