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
      recipient_user_id: { // Nom de colonne 'underscored'
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users', // Nom de la table référencée
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_user_id: { // Nom de colonne 'underscored'
        type: Sequelize.UUID,
        allowNull: true, // Peut être NULL (notifications système)
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL', // Garde la notif si l'acteur est supprimé
      },
      type: {
        type: Sequelize.ENUM( // Définit le type ENUM
          'like',
          'comment',
          'share',
          'follow',
          'mention',
          'system'
          // Ajoutez d'autres types ici si définis dans le modèle
        ),
        allowNull: false,
      },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false, // Non lue par défaut
      },
      voice_note_id: { // Nom de colonne 'underscored'
        type: Sequelize.UUID,
        allowNull: true, // Peut être NULL
        references: {
          model: 'voice_notes', // Nom de la table référencée
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Supprime la notif si la note est supprimée
      },
      comment_id: { // Nom de colonne 'underscored'
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'comments', // Nom de la table référencée
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reaction_id: { // Nom de colonne 'underscored'
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'reactions', // Nom de la table référencée
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      share_id: { // Nom de colonne 'underscored'
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shares', // Nom de la table référencée
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { // Nom de colonne 'underscored'
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') // Valeur par défaut gérée par la DB
      },
      updated_at: { // Nom de colonne 'underscored'
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

    // Optionnel: Supprimer le type ENUM si votre base de données le nécessite (ex: PostgreSQL)
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_type";');

    console.log("Migration 'create-notifications-table' DOWN terminée.");
  }
};