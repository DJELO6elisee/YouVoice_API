'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    
    await queryInterface.addColumn(
      'reactions', 
      'updated_at', 
      {
        type: Sequelize.DATE, 
        allowNull: true 
      }
    );
  },

  async down (queryInterface, Sequelize) {
    /**
     * Commandes pour annuler l'ajout (supprimer la colonne).
     */
    await queryInterface.removeColumn(
      'reactions', 
      'updated_at' /
    );
  }
};