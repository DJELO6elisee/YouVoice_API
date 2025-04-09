// dans migrations/YYYYMMDDHHMMSS-add-admin-and-active-status-to-users.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Ajouter la colonne is_admin
    await queryInterface.addColumn('users', 'is_admin', { // Nom de table et nom de colonne
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Définit la valeur pour les lignes existantes aussi
      after: 'pays' // Optionnel: Place la colonne après 'pays'
    });
    console.log("Colonne 'is_admin' ajoutée à la table 'users'.");

    // Ajouter la colonne is_active
    await queryInterface.addColumn('users', 'is_active', { // Nom de table et nom de colonne
       type: Sequelize.BOOLEAN,
       allowNull: false,
       defaultValue: true, // Les utilisateurs existants sont considérés actifs par défaut
       after: 'is_admin' // Optionnel: Place la colonne après 'is_admin'
     });
    console.log("Colonne 'is_active' ajoutée à la table 'users'.");
  },

  async down (queryInterface, Sequelize) {
    // Instructions pour annuler la migration
    await queryInterface.removeColumn('users', 'is_active');
    console.log("Colonne 'is_active' retirée de la table 'users'.");
    await queryInterface.removeColumn('users', 'is_admin');
    console.log("Colonne 'is_admin' retirée de la table 'users'.");
  }
};