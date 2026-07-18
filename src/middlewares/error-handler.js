const ERROR_CODES = require('../constants/error-codes');

function errorHandler(error, _request, response, _next) {
  const statusCode = error.isOperational ? error.statusCode : 500;
  const code = error.isOperational ? error.code : ERROR_CODES.INTERNAL_ERROR;
  const message = error.isOperational
    ? error.message
    : 'Ocorreu um erro interno no servidor.';
  const fields = error.isOperational ? error.fields : [];

  if (!error.isOperational) {
    console.error(error);
  }

  return response.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      fields,
    },
  });
}

module.exports = errorHandler;
