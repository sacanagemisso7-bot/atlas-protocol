const ERROR_CODES = require('../constants/error-codes');
const AppError = require('../utils/app-error');

function allowRoles(...roles) {
  return (request, _response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(
        new AppError(
          403,
          ERROR_CODES.FORBIDDEN,
          'Você não possui permissão para realizar esta operação.',
        ),
      );
    }

    return next();
  };
}

module.exports = allowRoles;
