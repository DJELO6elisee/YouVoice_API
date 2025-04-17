// Dans le fichier migrations/YYYYMMDDHHMMSS-create-notifications-table.js

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', { // Utilise le nom de table spécifié ('notifications')
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      recipient_user_id: { 
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_user_id: { 
        type: Sequelize.UUID,
        allowNull: true, 
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL', 
      },
      type: {
        type: Sequelize.ENUM( 
          'like',
          'comment',
          'share',
          'follow',
          'mention',
          'system'
        ),
        allowNull: false,
      },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false, 
      },
      voice_note_id: { 
        type: Sequelize.UUID,
        allowNull: true, 
        references: {
          model: 'voice_notes', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', 
      },
      comment_id: { 
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'comments', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reaction_id: { 
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'reactions', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      share_id: { 
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shares', 
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { 
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') // Valeur par défaut gérée par la DB
      },
      updated_at: { 
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Ajouter les index après la création de la table
    await queryInterface.addIndex('notifications', ['recipient_user_id', 'read', 'created_at']);
    await queryInterface.addIndex('notifications', ['recipient_user_id', 'created_at']);

    console.log("Migration 'create-notifications-table' UP terminée.");
  },

  async down (queryInterface, Sequelize) {
    // Supprimer d'abord les index (bonne pratique, bien que dropTable le fasse souvent)
    await queryInterface.removeIndex('notifications', ['recipient_user_id', 'read', 'created_at']);
    await queryInterface.removeIndex('notifications', ['recipient_user_id', 'created_at']);

    // Puis supprimer la table
    await queryInterface.dropTable('notifications');

    
    console.log("Migration 'create-notifications-table' DOWN terminée.");
  }
};