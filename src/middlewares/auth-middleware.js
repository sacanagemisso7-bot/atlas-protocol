const jwt = require('jsonwebtoken');

const ERROR_CODES = require('../constants/error-codes');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');
const { verifyToken } = require('../utils/jwt');

const authMiddleware = asyncHandler(async (request, _response, next) => {
  const authorization = request.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new AppError(
      401,
      ERROR_CODES.AUTH_REQUIRED,
      'Autenticação necessária.',
    );
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    throw new AppError(
      401,
      ERROR_CODES.AUTH_REQUIRED,
      'Autenticação necessária.',
    );
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(
        401,
        ERROR_CODES.TOKEN_EXPIRED,
        'Token expirado.',
      );
    }

    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, 'Token inválido.');
  }

  const user = await User.findById(payload.sub);

  if (!user) {
    throw new AppError(401, ERROR_CODES.INVALID_TOKEN, 'Token inválido.');
  }

  if (!user.active || user.blockedAt) {
    throw new AppError(
      403,
      ERROR_CODES.USER_BLOCKED,
      'Usuário bloqueado ou inativo.',
    );
  }

  request.user = user;
  return next();
});

module.exports = authMiddleware;
