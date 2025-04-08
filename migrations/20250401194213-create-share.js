'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shares', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      voice_note_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'voice_notes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      shared_to: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
      // Pas d'updated_at ici
    });
    // Ajouter des index
    await queryInterface.addIndex('shares', ['user_id']);
    await queryInterface.addIndex('shares', ['voice_note_id']);
    await queryInterface.addIndex('shares', ['shared_to']); // Index sur shared_to peut être utile
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shares');
  }
};