const CHECK_IN_STATUSES = require('../constants/check-in-statuses');
const ERROR_CODES = require('../constants/error-codes');
const LINK_STATUSES = require('../constants/link-statuses');
const PROTOCOL_STATUSES = require('../constants/protocol-statuses');
const USER_ROLES = require('../constants/user-roles');
const CheckIn = require('../models/check-in');
const ProfessionalAthleteLink = require('../models/professional-athlete-link');
const Protocol = require('../models/protocol');
const AppError = require('../utils/app-error');
const { toCheckInResponse } = require('../utils/check-in-response');
const { normalizeReferenceWeek } = require('../utils/normalize-reference-week');

function notFoundError(resource = 'Check-in') {
  return new AppError(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} não encontrado.`,
  );
}

function forbiddenError(message = 'Você não possui permissão para esta operação.') {
  return new AppError(403, ERROR_CODES.FORBIDDEN, message);
}

function validationError(field, message) {
  return new AppError(
    400,
    ERROR_CODES.VALIDATION_ERROR,
    'Dados inválidos.',
    [{ field, message }],
  );
}

function invalidTransitionError(message = 'Transição de estado inválida.') {
  return new AppError(
    422,
    ERROR_CODES.INVALID_STATE_TRANSITION,
    message,
  );
}

function duplicateCheckInError() {
  return new AppError(
    409,
    ERROR_CODES.CHECKIN_ALREADY_EXISTS,
    'Já existe um check-in para o atleta nesta semana.',
  );
}

function sameId(left, right) {
  return left && right && left.toString() === right.toString();
}

async function hasActiveLink(professionalId, athleteId) {
  return ProfessionalAthleteLink.exists({
    professionalId,
    athleteId,
    status: LINK_STATUSES.ACTIVE,
  });
}

async function resolveProfessionalContext(athleteId, protocolId) {
  if (protocolId) {
    const protocol = await Protocol.findById(protocolId);
    if (!protocol) throw notFoundError('Protocolo');
    if (!sameId(protocol.athleteId, athleteId)) {
      throw validationError(
        'protocolId',
        'O protocolo informado não pertence ao atleta.',
      );
    }
    if (protocol.status !== PROTOCOL_STATUSES.ACTIVE) {
      throw invalidTransitionError(
        'Novos check-ins só podem ser vinculados a protocolos ativos.',
      );
    }
    if (!(await hasActiveLink(protocol.professionalId, athleteId))) {
      throw forbiddenError('É necessário possuir vínculo ativo com o profissional.');
    }
    return {
      professionalId: protocol.professionalId,
      protocolId: protocol.id,
    };
  }

  const links = await ProfessionalAthleteLink.find({
    athleteId,
    status: LINK_STATUSES.ACTIVE,
  })
    .sort({ startedAt: -1, createdAt: -1 })
    .select('professionalId');

  if (!links.length) {
    throw forbiddenError('É necessário possuir vínculo ativo com um profissional.');
  }
  if (links.length > 1) {
    throw validationError(
      'protocolId',
      'Informe protocolId para definir o profissional responsável.',
    );
  }

  return {
    professionalId: links[0].professionalId,
    protocolId: null,
  };
}

async function canAccessCheckIn(requester, checkIn) {
  if (requester.role === USER_ROLES.ADMIN) return true;
  if (requester.role === USER_ROLES.ATHLETE) {
    return sameId(checkIn.athleteId, requester.id);
  }
  if (requester.role === USER_ROLES.PROFESSIONAL) {
    return Boolean(await hasActiveLink(requester.id, checkIn.athleteId));
  }
  return false;
}

async function getAccessibleCheckIn(requester, checkInId) {
  const checkIn = await CheckIn.findById(checkInId);
  if (!checkIn || !(await canAccessCheckIn(requester, checkIn))) {
    throw notFoundError();
  }
  return checkIn;
}

async function createCheckIn(requester, input) {
  const athleteId = input.athleteId || requester.id;
  if (!sameId(athleteId, requester.id)) {
    throw forbiddenError('O atleta só pode criar check-ins para si mesmo.');
  }

  const context = await resolveProfessionalContext(athleteId, input.protocolId);
  const referenceWeek = normalizeReferenceWeek(input.referenceWeek);
  if (await CheckIn.exists({ athleteId, referenceWeek })) {
    throw duplicateCheckInError();
  }

  try {
    const checkIn = await CheckIn.create({
      athleteId,
      professionalId: context.professionalId,
      protocolId: context.protocolId,
      referenceWeek,
      status: CHECK_IN_STATUSES.PENDING,
      answers: input.answers || {},
    });
    return toCheckInResponse(checkIn);
  } catch (error) {
    if (error.code === 11000) throw duplicateCheckInError();
    throw error;
  }
}

async function listCheckIns(requester, query) {
  const filters = {};
  if (query.athleteId) filters.athleteId = query.athleteId;
  if (query.protocolId) filters.protocolId = query.protocolId;
  if (query.status) filters.status = query.status;
  if (query.dateFrom || query.dateTo) {
    filters.referenceWeek = {};
    if (query.dateFrom) filters.referenceWeek.$gte = query.dateFrom;
    if (query.dateTo) filters.referenceWeek.$lte = query.dateTo;
  }

  if (requester.role === USER_ROLES.PROFESSIONAL) {
    const links = await ProfessionalAthleteLink.find({
      professionalId: requester.id,
      status: LINK_STATUSES.ACTIVE,
    }).select('athleteId');
    filters.athleteId = { $in: links.map((link) => link.athleteId) };
  } else if (requester.role === USER_ROLES.ATHLETE) {
    filters.athleteId = requester.id;
  }

  const skip = (query.page - 1) * query.limit;
  const sort = { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 };
  const [checkIns, total] = await Promise.all([
    CheckIn.find(filters).sort(sort).skip(skip).limit(query.limit),
    CheckIn.countDocuments(filters),
  ]);

  return {
    checkIns: checkIns.map(toCheckInResponse),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

async function getCheckIn(requester, checkInId) {
  const checkIn = await getAccessibleCheckIn(requester, checkInId);
  return toCheckInResponse(checkIn);
}

async function updateCheckIn(requester, checkInId, input) {
  const checkIn = await getAccessibleCheckIn(requester, checkInId);
  if (requester.role !== USER_ROLES.ATHLETE) {
    throw forbiddenError('Apenas o atleta pode editar as próprias respostas.');
  }
  if (checkIn.status !== CHECK_IN_STATUSES.PENDING) {
    throw invalidTransitionError(
      'Somente check-ins pendentes podem ser editados pelo atleta.',
    );
  }

  if (input.protocolId !== undefined) {
    const context = await resolveProfessionalContext(
      checkIn.athleteId,
      input.protocolId,
    );
    checkIn.protocolId = context.protocolId;
    checkIn.professionalId = context.professionalId;
  }

  if (input.referenceWeek !== undefined) {
    const referenceWeek = normalizeReferenceWeek(input.referenceWeek);
    const duplicate = await CheckIn.exists({
      _id: { $ne: checkIn.id },
      athleteId: checkIn.athleteId,
      referenceWeek,
    });
    if (duplicate) throw duplicateCheckInError();
    checkIn.referenceWeek = referenceWeek;
  }

  if (input.answers !== undefined) {
    const currentAnswers = checkIn.answers
      ? checkIn.answers.toObject()
      : {};
    checkIn.answers = { ...currentAnswers, ...input.answers };
  }

  try {
    await checkIn.save();
  } catch (error) {
    if (error.code === 11000) throw duplicateCheckInError();
    throw error;
  }
  return toCheckInResponse(checkIn);
}

async function submitCheckIn(requester, checkInId) {
  const checkIn = await getAccessibleCheckIn(requester, checkInId);
  if (requester.role !== USER_ROLES.ATHLETE) {
    throw forbiddenError('Apenas o atleta pode enviar o próprio check-in.');
  }
  if (checkIn.status !== CHECK_IN_STATUSES.PENDING) {
    throw invalidTransitionError('Somente check-ins pendentes podem ser enviados.');
  }

  checkIn.status = CHECK_IN_STATUSES.SUBMITTED;
  checkIn.submittedAt = new Date();
  await checkIn.save();
  return toCheckInResponse(checkIn);
}

async function reviewCheckIn(requester, checkInId, input) {
  const checkIn = await getAccessibleCheckIn(requester, checkInId);
  if (requester.role !== USER_ROLES.PROFESSIONAL) {
    throw forbiddenError('Apenas profissionais vinculados podem revisar check-ins.');
  }
  if (checkIn.status !== CHECK_IN_STATUSES.SUBMITTED) {
    throw invalidTransitionError(
      'Somente check-ins enviados podem ser revisados.',
    );
  }

  checkIn.status = CHECK_IN_STATUSES.REVIEWED;
  checkIn.reviewedAt = new Date();
  checkIn.reviewedBy = requester.id;
  checkIn.reviewComment = input.reviewComment;
  await checkIn.save();
  return toCheckInResponse(checkIn);
}

module.exports = {
  createCheckIn,
  getCheckIn,
  listCheckIns,
  reviewCheckIn,
  submitCheckIn,
  updateCheckIn,
};
