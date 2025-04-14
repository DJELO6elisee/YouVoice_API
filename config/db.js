const { Sequelize } = require('sequelize');
const config = require('./config.js');

const env = process.env.NODE_ENV || 'production';
const dbConfig = config[env];

// Gestion spéciale pour les valeurs "process.env..."
const processEnvValue = (value) => {
  if (typeof value === 'string' && value.startsWith('process.env.')) {
    const envVar = value.replace('process.env.', '');
    return process.env[envVar] || '';
  }
  return value;
};

const sequelize = new Sequelize(
  processEnvValue(dbConfig.database),
  processEnvValue(dbConfig.username),
  processEnvValue(dbConfig.password),
  {
    host: processEnvValue(dbConfig.host),
    port: processEnvValue(dbConfig.port),
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    define: {
      ...dbConfig.define
    },
    pool: {
      ...dbConfig.pool
    },
    dialectOptions: env === 'development' ? dbConfig.dialectOptions : {}
  }
);

// Test de connexion
sequelize.authenticate()
  .then(() => {
    console.log(`Connecté à MySQL (${env})`);
    
    // Synchronisation automatique en développement seulement
    if (env === 'development') {
      sequelize.sync({ alter: true })
        .then(() => console.log('Base de données synchronisée'))
        .catch(console.error);
    }
  })
  .catch(err => {
    console.error('Erreur de connexion MySQL:', err);
    
    if (env === 'production') {
      // Tentative de reconnexion en production
      setTimeout(() => {
        console.log('Nouvelle tentative de connexion...');
        sequelize.authenticate();
      }, 5000);
    }
  });

module.exports = sequelize;