const ERROR_CODES = require('../constants/error-codes');
const LINK_STATUSES = require('../constants/link-statuses');
const PROTOCOL_STATUSES = require('../constants/protocol-statuses');
const TRACKING_RECORD_STATUSES = require('../constants/tracking-record-statuses');
const TRACKING_RECORD_TYPES = require('../constants/tracking-record-types');
const USER_ROLES = require('../constants/user-roles');
const ProfessionalAthleteLink = require('../models/professional-athlete-link');
const Protocol = require('../models/protocol');
const TrackingRecord = require('../models/tracking-record');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const {
  toTrackingRecordResponse,
} = require('../utils/tracking-record-response');

function notFoundError(resource = 'Registro de acompanhamento') {
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

async function assertAthlete(athleteId) {
  const athlete = await User.findById(athleteId);
  if (!athlete) throw notFoundError('Atleta');
  if (athlete.role !== USER_ROLES.ATHLETE) {
    throw validationError(
      'athleteId',
      'O usuário informado deve possuir o perfil athlete.',
    );
  }
  if (!athlete.active || athlete.blockedAt) {
    throw validationError('athleteId', 'O atleta informado está inativo.');
  }
  return athlete;
}

async function resolveProtocolContext(requester, athleteId, protocolId) {
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
      'Novos registros só podem ser vinculados a protocolos ativos.',
    );
  }
  if (
    requester.role === USER_ROLES.PROFESSIONAL &&
    !sameId(protocol.professionalId, requester.id)
  ) {
    throw notFoundError('Protocolo');
  }
  if (!(await hasActiveLink(protocol.professionalId, athleteId))) {
    throw forbiddenError('É necessário possuir vínculo ativo com o atleta.');
  }

  return {
    professionalId: protocol.professionalId,
    protocolId: protocol.id,
    protocolVersion: protocol.currentVersion,
  };
}

async function resolveManualContext(requester, athleteId, protocolId) {
  if (protocolId) {
    return resolveProtocolContext(requester, athleteId, protocolId);
  }

  if (requester.role === USER_ROLES.PROFESSIONAL) {
    if (!(await hasActiveLink(requester.id, athleteId))) {
      throw forbiddenError('É necessário possuir vínculo ativo com o atleta.');
    }
    return {
      professionalId: requester.id,
      protocolId: null,
      protocolVersion: null,
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
      'Informe um protocolo ativo para definir o profissional responsável.',
    );
  }

  return {
    professionalId: links[0].professionalId,
    protocolId: null,
    protocolVersion: null,
  };
}

async function canAccessRecord(requester, record) {
  if (requester.role === USER_ROLES.ADMIN) return true;
  if (requester.role === USER_ROLES.ATHLETE) {
    return sameId(record.athleteId, requester.id);
  }
  if (requester.role === USER_ROLES.PROFESSIONAL) {
    return Boolean(await hasActiveLink(requester.id, record.athleteId));
  }
  return false;
}

async function getAccessibleRecord(requester, recordId) {
  const record = await TrackingRecord.findById(recordId);
  if (!record || !(await canAccessRecord(requester, record))) {
    throw notFoundError();
  }
  return record;
}

async function createTrackingRecord(requester, input) {
  let athleteId = input.athleteId;
  if (requester.role === USER_ROLES.ATHLETE) {
    athleteId = athleteId || requester.id;
    if (!sameId(athleteId, requester.id)) {
      throw forbiddenError('O atleta só pode criar registros para si mesmo.');
    }
  } else if (!athleteId) {
    throw validationError('athleteId', 'Informe o atleta.');
  }

  const athlete = await assertAthlete(athleteId);
  const context = await resolveManualContext(
    requester,
    athlete.id,
    input.protocolId,
  );

  const record = await TrackingRecord.create({
    athleteId: athlete.id,
    professionalId: context.professionalId,
    protocolId: context.protocolId,
    protocolVersion: context.protocolVersion,
    protocolItemId: null,
    type: TRACKING_RECORD_TYPES.MANUAL,
    title: input.title,
    scheduledFor: input.scheduledFor,
    status: TRACKING_RECORD_STATUSES.SCHEDULED,
    notes: input.notes || null,
  });

  return toTrackingRecordResponse(record);
}

async function listTrackingRecords(requester, query) {
  const filters = {};
  if (query.athleteId) filters.athleteId = query.athleteId;
  if (query.professionalId) filters.professionalId = query.professionalId;
  if (query.protocolId) filters.protocolId = query.protocolId;
  if (query.status) filters.status = query.status;
  if (query.dateFrom || query.dateTo) {
    filters.scheduledFor = {};
    if (query.dateFrom) filters.scheduledFor.$gte = query.dateFrom;
    if (query.dateTo) filters.scheduledFor.$lte = query.dateTo;
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
  const [records, total] = await Promise.all([
    TrackingRecord.find(filters).sort(sort).skip(skip).limit(query.limit),
    TrackingRecord.countDocuments(filters),
  ]);

  return {
    records: records.map(toTrackingRecordResponse),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

async function getTrackingRecord(requester, recordId) {
  const record = await getAccessibleRecord(requester, recordId);
  return toTrackingRecordResponse(record);
}

async function updateTrackingRecord(requester, recordId, input) {
  const record = await getAccessibleRecord(requester, recordId);
  if (requester.role !== USER_ROLES.PROFESSIONAL) {
    throw forbiddenError('Apenas profissionais podem editar este registro.');
  }
  if (record.status !== TRACKING_RECORD_STATUSES.SCHEDULED) {
    throw invalidTransitionError(
      'Registros finalizados não podem ser editados neste fluxo.',
    );
  }

  if (input.protocolId !== undefined) {
    if (input.protocolId === null) {
      record.protocolId = null;
      record.protocolVersion = null;
      record.protocolItemId = null;
    } else {
      const context = await resolveProtocolContext(
        requester,
        record.athleteId,
        input.protocolId,
      );
      record.protocolId = context.protocolId;
      record.protocolVersion = context.protocolVersion;
      record.protocolItemId = null;
      record.professionalId = context.professionalId;
    }
  }
  if (input.title !== undefined) record.title = input.title;
  if (input.scheduledFor !== undefined) record.scheduledFor = input.scheduledFor;
  if (input.notes !== undefined) record.notes = input.notes || null;

  await record.save();
  return toTrackingRecordResponse(record);
}

async function transitionTrackingRecord(requester, recordId, input) {
  const record = await getAccessibleRecord(requester, recordId);
  if (requester.role === USER_ROLES.ADMIN) {
    throw forbiddenError('Administradores não alteram registros no MVP.');
  }
  if (record.status !== TRACKING_RECORD_STATUSES.SCHEDULED) {
    throw invalidTransitionError('O registro já está em um estado final.');
  }

  const finalStatuses = [
    TRACKING_RECORD_STATUSES.COMPLETED,
    TRACKING_RECORD_STATUSES.MISSED,
    TRACKING_RECORD_STATUSES.CANCELLED,
  ];
  if (!finalStatuses.includes(input.status)) {
    throw invalidTransitionError();
  }
  if (
    input.status !== TRACKING_RECORD_STATUSES.COMPLETED &&
    input.completedAt
  ) {
    throw validationError(
      'completedAt',
      'completedAt só pode ser informado para registros concluídos.',
    );
  }

  record.status = input.status;
  if (input.status === TRACKING_RECORD_STATUSES.COMPLETED) {
    record.completedAt = input.completedAt || new Date();
    record.completedBy = requester.id;
  } else {
    record.completedAt = null;
    record.completedBy = null;
  }
  if (input.notes !== undefined) record.notes = input.notes || null;

  await record.save();
  return toTrackingRecordResponse(record);
}

module.exports = {
  createTrackingRecord,
  getTrackingRecord,
  listTrackingRecords,
  transitionTrackingRecord,
  updateTrackingRecord,
};
