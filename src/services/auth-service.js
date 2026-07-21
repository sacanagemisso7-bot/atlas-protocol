const bcrypt = require('bcrypt');

const env = require('../config/env');
const ERROR_CODES = require('../constants/error-codes');
const USER_ROLES = require('../constants/user-roles');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const { generateToken } = require('../utils/jwt');
const toSafeUser = require('../utils/user-response');

function invalidCredentialsError() {
  return new AppError(
    401,
    ERROR_CODES.INVALID_CREDENTIALS,
    'E-mail ou senha inválidos.',
  );
}

function blockedUserError() {
  return new AppError(
    403,
    ERROR_CODES.USER_BLOCKED,
    'Usuário bloqueado ou inativo.',
  );
}

async function register({ name, email, password }) {
  const existingUser = await User.exists({ email });

  if (existingUser) {
    throw new AppError(
      409,
      ERROR_CODES.EMAIL_ALREADY_EXISTS,
      'Já existe um usuário com este e-mail.',
    );
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  let user;
  try {
    user = await User.create({
      name,
      email,
      passwordHash,
      role: USER_ROLES.ATHLETE,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(
        409,
        ERROR_CODES.EMAIL_ALREADY_EXISTS,
        'Já existe um usuário com este e-mail.',
      );
    }
    throw error;
  }

  return { user: toSafeUser(user), token: generateToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw invalidCredentialsError();
  }

  if (!user.active || user.blockedAt) {
    throw blockedUserError();
  }

  user.lastLoginAt = new Date();
  await user.save();

  return { user: toSafeUser(user), token: generateToken(user) };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(
      404,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      'Usuário não encontrado.',
    );
  }

  return toSafeUser(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw invalidCredentialsError();
  }

  user.passwordHash = await bcrypt.hash(
    newPassword,
    env.bcryptSaltRounds,
  );
  await user.save();

  return toSafeUser(user);
}

module.exports = { changePassword, getCurrentUser, login, register };
