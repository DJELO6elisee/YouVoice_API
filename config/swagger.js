const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vocal Notes API',
      version: '1.0.0',
      description: 'API documentation for Vocal Notes application',
    },
    servers: [
      {
        url: process.env.SERVER_URL || 'http://localhost:5000',
      },
    ],
  },
  apis: ['./routes/*.js'], // Chemin vers vos fichiers de routes
};

const specs = swaggerJsdoc(options);

module.exports = (app) => {
  app.use('/api-docs', 
    swaggerUi.serve, 
    swaggerUi.setup(specs, { explorer: true })
  );
};