const ERROR_CODES = require('../constants/error-codes');
const AppError = require('../utils/app-error');

function notFoundHandler(_request, _response, next) {
  next(
    new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      'Recurso não encontrado.',
    ),
  );
}

module.exports = notFoundHandler;
