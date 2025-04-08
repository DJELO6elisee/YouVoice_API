'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'full_name', { // Notez l'utilisation de snake_case ici
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'genre', {
      type: Sequelize.ENUM('homme', 'femme', 'autre', 'prefer_not_say'),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'pays', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Logique pour annuler les changements (supprimer les colonnes)
    await queryInterface.removeColumn('users', 'full_name');
    await queryInterface.removeColumn('users', 'genre');
    await queryInterface.removeColumn('users', 'pays');
  }
};