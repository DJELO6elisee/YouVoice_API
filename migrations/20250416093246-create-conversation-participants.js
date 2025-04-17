'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversation_participants', { 
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true, 
        references: {
          model: 'users',       
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', 
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true, 
        references: {
          model: 'conversations', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', 
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    
     await queryInterface.addIndex('conversation_participants', ['user_id']);
     await queryInterface.addIndex('conversation_participants', ['conversation_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversation_participants');
  }
};