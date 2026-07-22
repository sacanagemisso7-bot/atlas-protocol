const AUDIT_ACTIONS = require('../constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../constants/audit-entity-types');
const ERROR_CODES = require('../constants/error-codes');
const USER_ROLES = require('../constants/user-roles');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const toSafeUser = require('../utils/user-response');
const auditService = require('./audit-service');

function resourceNotFoundError() {
  return new AppError(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    'Usuário não encontrado.',
  );
}

function forbiddenError() {
  return new AppError(
    403,
    ERROR_CODES.FORBIDDEN,
    'Você não possui permissão para realizar esta operação.',
  );
}

function invalidAdminTransitionError() {
  return new AppError(
    422,
    ERROR_CODES.INVALID_STATE_TRANSITION,
    'O último administrador ativo não pode ser desativado ou ter o perfil alterado.',
  );
}

function invalidProfessionalRoleTransitionError() {
  return new AppError(
    422,
    ERROR_CODES.INVALID_STATE_TRANSITION,
    'Alterações para ou a partir do perfil profissional exigem o fluxo específico de verificação.',
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listUsers({ page, limit, role, active, search }) {
  const filters = {};

  if (role) filters.role = role;
  if (active !== undefined) filters.active = active;
  if (search) {
    const expression = new RegExp(escapeRegExp(search), 'i');
    filters.$or = [{ name: expression }, { email: expression }];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filters),
  ]);

  return {
    users: users.map(toSafeUser),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getUserById(requester, userId) {
  if (requester.role !== USER_ROLES.ADMIN && requester.id !== userId) {
    throw forbiddenError();
  }

  const user = await User.findById(userId);
  if (!user) throw resourceNotFoundError();

  return toSafeUser(user);
}

async function isLastActiveAdmin(user) {
  if (user.role !== USER_ROLES.ADMIN || !user.active || user.blockedAt) {
    return false;
  }

  const activeAdminCount = await User.countDocuments({
    role: USER_ROLES.ADMIN,
    active: true,
    blockedAt: null,
  });

  return activeAdminCount <= 1;
}

async function updateUser(requester, userId, updates) {
  const isOwnProfile = requester.id === userId;

  if (!isOwnProfile && requester.role !== USER_ROLES.ADMIN) {
    throw forbiddenError();
  }

  const administrativeFields = ['role', 'active'];
  const hasAdministrativeUpdate = administrativeFields.some(
    (field) => updates[field] !== undefined,
  );

  const user = await User.findById(userId);
  if (!user) throw resourceNotFoundError();

  const changesProfessionalRole =
    updates.role !== undefined &&
    updates.role !== user.role &&
    (updates.role === USER_ROLES.PROFESSIONAL ||
      user.role === USER_ROLES.PROFESSIONAL);

  if (changesProfessionalRole) {
    throw invalidProfessionalRoleTransitionError();
  }

  const removesActiveAdmin =
    user.role === USER_ROLES.ADMIN &&
    user.active &&
    !user.blockedAt &&
    ((updates.role !== undefined && updates.role !== USER_ROLES.ADMIN) ||
      updates.active === false);

  if (removesActiveAdmin && (await isLastActiveAdmin(user))) {
    throw invalidAdminTransitionError();
  }

  if (isOwnProfile && hasAdministrativeUpdate) {
    throw forbiddenError();
  }

  Object.assign(user, updates);
  await user.save();

  return toSafeUser(user);
}

async function setUserBlocked(requester, userId, blocked) {
  if (requester._id.equals(userId) && blocked) {
    throw new AppError(
      422,
      ERROR_CODES.INVALID_STATE_TRANSITION,
      'Um administrador não pode bloquear a própria conta.',
    );
  }

  const user = await User.findById(userId);
  if (!user) throw resourceNotFoundError();

  if (blocked && (await isLastActiveAdmin(user))) {
    throw invalidAdminTransitionError();
  }

  const wasBlocked = Boolean(user.blockedAt);
  user.blockedAt = blocked ? new Date() : null;
  await user.save();

  if (wasBlocked !== blocked) {
    await auditService.record({
      actorId: requester.id,
      action: blocked
        ? AUDIT_ACTIONS.USER_BLOCKED
        : AUDIT_ACTIONS.USER_UNBLOCKED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      metadata: { from: wasBlocked, to: blocked },
    });
  }

  return toSafeUser(user);
}

module.exports = { getUserById, listUsers, setUserBlocked, updateUser };
