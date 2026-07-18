const ERROR_CODES = require('../constants/error-codes');
const AppError = require('../utils/app-error');

function validate(schema) {
  return (request, _response, next) => {
    const { error, value } = schema.validate(request.body, {
      abortEarly: false,
      stripUnknown: false,
    });

    if (error) {
      const fields = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message:
          detail.type === 'object.unknown'
            ? `O campo ${detail.path.join('.')} não é permitido.`
            : detail.message,
      }));

      return next(
        new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Dados inválidos.',
          fields,
        ),
      );
    }

    request.body = value;
    return next();
  };
}

module.exports = validate;
