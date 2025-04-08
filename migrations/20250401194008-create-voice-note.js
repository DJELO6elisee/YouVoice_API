'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('voice_notes', {
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
          model: 'users', // Nom de la table référencée
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Important: que faire si l'utilisateur est supprimé ?
      },
      audio_url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    // Optionnel mais recommandé : Ajouter un index sur la clé étrangère pour la performance
    await queryInterface.addIndex('voice_notes', ['user_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('voice_notes');
  }
};