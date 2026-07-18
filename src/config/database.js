const mongoose = require('mongoose');

async function connectDatabase(mongodbUri) {
  await mongoose.connect(mongodbUri);
  console.info('Conexão com o MongoDB estabelecida.');
}

module.exports = connectDatabase;
