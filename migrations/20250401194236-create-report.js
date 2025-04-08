'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reports', {
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
        onDelete: 'CASCADE', // Ou SET NULL
      },
      voice_note_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'voice_notes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Important
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'reviewed', 'resolved'),
        allowNull: false,
        defaultValue: 'pending',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });
    // Ajouter des index
    await queryInterface.addIndex('reports', ['user_id']);
    await queryInterface.addIndex('reports', ['voice_note_id']);
    await queryInterface.addIndex('reports', ['status']); // Index sur status pour filtrer/trier
    // Optionnel: Index unique comme défini dans le modèle si nécessaire
    // await queryInterface.addIndex('reports', ['user_id', 'voice_note_id'], { unique: true, name: 'unique_user_voicenote_report' });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reports');
  }
};