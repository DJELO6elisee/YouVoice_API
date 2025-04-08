'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reactions', {
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
      emoji: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
      // Pas d'updated_at ici si désactivé dans le modèle
    });
    // Ajouter des index
    await queryInterface.addIndex('reactions', ['user_id']);
    await queryInterface.addIndex('reactions', ['voice_note_id']);
    // Optionnel: Index unique comme défini dans le modèle si nécessaire
    // await queryInterface.addIndex('reactions', ['user_id', 'voice_note_id', 'emoji'], { unique: true, name: 'unique_user_voicenote_emoji_reaction' });
     // Ou si une seule réaction par user/note :
     await queryInterface.addIndex('reactions', ['user_id', 'voice_note_id'], { unique: true, name: 'unique_user_voicenote_reaction' });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reactions');
  }
};