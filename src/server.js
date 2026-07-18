const app = require('./app');
const connectDatabase = require('./config/database');
const env = require('./config/env');

let server;

async function startServer() {
  try {
    await connectDatabase(env.mongodbUri);

    server = app.listen(env.port, () => {
      console.info(`Servidor iniciado na porta ${env.port}.`);
    });
  } catch (error) {
    console.error(`Falha ao iniciar a aplicação: ${error.message}`);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.info(`${signal} recebido. Encerrando a aplicação.`);

  if (!server) {
    process.exit(0);
  }

  server.close(async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
