const ERROR_CODES = require('../constants/error-codes');
const LINK_STATUSES = require('../constants/link-statuses');
const USER_ROLES = require('../constants/user-roles');
const ProfessionalAthleteLink = require('../models/professional-athlete-link');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const toLinkResponse = require('../utils/link-response');

function resourceNotFoundError(resource = 'Vínculo') {
  return new AppError(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} não encontrado.`,
  );
}

function invalidProfileError(field, message) {
  return new AppError(
    400,
    ERROR_CODES.VALIDATION_ERROR,
    'Dados inválidos.',
    [{ field, message }],
  );
}

function duplicateActiveLinkError() {
  return new AppError(
    409,
    ERROR_CODES.ACTIVE_LINK_ALREADY_EXISTS,
    'Já existe um vínculo ativo entre o profissional e o atleta.',
  );
}

function hasLinkAccess(requester, link) {
  return (
    requester.role === USER_ROLES.ADMIN ||
    link.professionalId.toString() === requester.id ||
    link.athleteId.toString() === requester.id
  );
}

async function createLink(requester, { professionalId, athleteId }) {
  if (professionalId === athleteId) {
    throw invalidProfileError(
      'athleteId',
      'O profissional e o atleta devem ser usuários diferentes.',
    );
  }

  const [professional, athlete] = await Promise.all([
    User.findById(professionalId),
    User.findById(athleteId),
  ]);

  if (!professional) throw resourceNotFoundError('Profissional');
  if (!athlete) throw resourceNotFoundError('Atleta');

  if (professional.role !== USER_ROLES.PROFESSIONAL) {
    throw invalidProfileError(
      'professionalId',
      'O usuário informado deve possuir o perfil professional.',
    );
  }
  if (athlete.role !== USER_ROLES.ATHLETE) {
    throw invalidProfileError(
      'athleteId',
      'O usuário informado deve possuir o perfil athlete.',
    );
  }

  const existingLink = await ProfessionalAthleteLink.exists({
    professionalId,
    athleteId,
    status: LINK_STATUSES.ACTIVE,
  });
  if (existingLink) throw duplicateActiveLinkError();

  try {
    const link = await ProfessionalAthleteLink.create({
      professionalId,
      athleteId,
      status: LINK_STATUSES.ACTIVE,
      invitedBy: requester.id,
      startedAt: new Date(),
    });
    return toLinkResponse(link);
  } catch (error) {
    if (error.code === 11000) throw duplicateActiveLinkError();
    throw error;
  }
}

async function listLinks(requester, query) {
  const { page, limit, status } = query;
  const filters = {};

  if (status) filters.status = status;
  if (query.professionalId) filters.professionalId = query.professionalId;
  if (query.athleteId) filters.athleteId = query.athleteId;

  if (requester.role === USER_ROLES.PROFESSIONAL) {
    filters.professionalId = requester.id;
  } else if (requester.role === USER_ROLES.ATHLETE) {
    filters.athleteId = requester.id;
  }

  const skip = (page - 1) * limit;
  const [links, total] = await Promise.all([
    ProfessionalAthleteLink.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ProfessionalAthleteLink.countDocuments(filters),
  ]);

  return {
    links: links.map(toLinkResponse),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getLinkById(requester, linkId) {
  const link = await ProfessionalAthleteLink.findById(linkId);

  if (!link || !hasLinkAccess(requester, link)) {
    throw resourceNotFoundError();
  }

  return toLinkResponse(link);
}

async function endLink(requester, linkId) {
  const link = await ProfessionalAthleteLink.findById(linkId);

  if (!link || !hasLinkAccess(requester, link)) {
    throw resourceNotFoundError();
  }

  if (link.status === LINK_STATUSES.ENDED) {
    throw new AppError(
      422,
      ERROR_CODES.INVALID_STATE_TRANSITION,
      'O vínculo já está encerrado.',
    );
  }

  if (link.status !== LINK_STATUSES.ACTIVE) {
    throw new AppError(
      422,
      ERROR_CODES.INVALID_STATE_TRANSITION,
      'Apenas vínculos ativos podem ser encerrados.',
    );
  }

  link.status = LINK_STATUSES.ENDED;
  link.endedAt = new Date();
  await link.save();

  return toLinkResponse(link);
}

module.exports = { createLink, endLink, getLinkById, listLinks };
