const ERROR_CODES = require('../constants/error-codes');
const AppError = require('../utils/app-error');

function validate(schema, property = 'body') {
  return (request, _response, next) => {
    const { error, value } = schema.validate(request[property], {
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
      const invalidObjectId = error.details.some(
        (detail) =>
          property === 'params' &&
          detail.path.at(-1) === 'id' &&
          detail.type === 'string.pattern.base',
      );

      return next(
        new AppError(
          400,
          invalidObjectId
            ? ERROR_CODES.INVALID_OBJECT_ID
            : ERROR_CODES.VALIDATION_ERROR,
          invalidObjectId ? 'Identificador inválido.' : 'Dados inválidos.',
          fields,
        ),
      );
    }

    request[property] = value;
    return next();
  };
}

module.exports = validate;
