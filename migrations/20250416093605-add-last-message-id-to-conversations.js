'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'conversations', 
      'last_message_id', 
      {
        type: Sequelize.UUID,
        allowNull: true, 
        references: {
          model: 'messages', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL', 
      }
    );
     await queryInterface.addIndex('conversations', ['last_message_id']);
  },

  async down(queryInterface, Sequelize) {
    // D'abord supprimer l'index si vous l'avez ajouté
     await queryInterface.removeIndex('conversations', ['last_message_id']);
     // Ensuite supprimer la colonne
    await queryInterface.removeColumn('conversations', 'last_message_id');
  }
};