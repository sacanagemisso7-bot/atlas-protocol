const ERROR_CODES = require('../constants/error-codes');
const LINK_STATUSES = require('../constants/link-statuses');
const PROTOCOL_STATUSES = require('../constants/protocol-statuses');
const USER_ROLES = require('../constants/user-roles');
const ProfessionalAthleteLink = require('../models/professional-athlete-link');
const Protocol = require('../models/protocol');
const ProtocolVersion = require('../models/protocol-version');
const Substance = require('../models/substance');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const {
  toProtocolResponse,
  toVersionResponse,
} = require('../utils/protocol-response');

function notFoundError(resource = 'Protocolo') {
  return new AppError(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} não encontrado.`,
  );
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

async function hasActiveLink(professionalId, athleteId) {
  return ProfessionalAthleteLink.exists({
    professionalId,
    athleteId,
    status: LINK_STATUSES.ACTIVE,
  });
}

async function assertProfessionalAccess(requester, protocol) {
  if (protocol.professionalId.toString() !== requester.id) {
    throw notFoundError();
  }
  if (!(await hasActiveLink(requester.id, protocol.athleteId))) {
    throw notFoundError();
  }
}

async function getAccessibleProtocol(requester, protocolId) {
  const protocol = await Protocol.findById(protocolId);
  if (!protocol) throw notFoundError();

  if (requester.role === USER_ROLES.ADMIN) return protocol;
  if (requester.role === USER_ROLES.PROFESSIONAL) {
    await assertProfessionalAccess(requester, protocol);
    return protocol;
  }
  if (
    requester.role === USER_ROLES.ATHLETE &&
    protocol.athleteId.toString() === requester.id
  ) {
    return protocol;
  }

  throw notFoundError();
}

async function getOwnedProtocol(requester, protocolId) {
  const protocol = await getAccessibleProtocol(requester, protocolId);
  if (requester.role !== USER_ROLES.PROFESSIONAL) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Você não possui permissão para alterar este protocolo.',
    );
  }
  return protocol;
}

function validateDateRange(startDate, endDate, continuous) {
  if (endDate && new Date(endDate) < new Date(startDate)) {
    throw validationError(
      'endDate',
      'A data final não pode ser anterior à data inicial.',
    );
  }
  if (!continuous && !endDate) {
    throw validationError(
      'endDate',
      'Informe endDate quando o protocolo não for contínuo.',
    );
  }
}

async function buildItems(items) {
  if (!items.length) return [];

  const substanceIds = [...new Set(items.map((item) => item.substanceId))];
  const substances = await Substance.find({ _id: { $in: substanceIds } });
  const substanceMap = new Map(
    substances.map((substance) => [substance.id, substance]),
  );

  return items.map((item, index) => {
    const substance = substanceMap.get(item.substanceId);
    if (!substance) throw notFoundError('Substância');
    if (!substance.active) {
      throw validationError(
        `items.${index}.substanceId`,
        'A substância informada está inativa.',
      );
    }

    return {
      ...item,
      substanceSnapshot: {
        name: substance.name,
        category: substance.category,
      },
      instructions: item.instructions || null,
      time: item.time || null,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      dosage: item.dosage || null,
      unit: item.unit || null,
      frequency: item.frequency || null,
      schedule: item.schedule || null,
      notes: item.notes || null,
    };
  });
}

async function createProtocol(requester, input) {
  const athlete = await User.findById(input.athleteId);
  if (!athlete) throw notFoundError('Atleta');
  if (athlete.role !== USER_ROLES.ATHLETE) {
    throw validationError(
      'athleteId',
      'O usuário informado deve possuir o perfil athlete.',
    );
  }
  if (!(await hasActiveLink(requester.id, athlete.id))) {
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'É necessário possuir vínculo ativo com o atleta.',
    );
  }

  validateDateRange(input.startDate, input.endDate, input.continuous);
  const items = await buildItems(input.items);
  const protocol = await Protocol.create({
    athleteId: athlete.id,
    professionalId: requester.id,
    title: input.title,
    objective: input.objective || null,
    status: PROTOCOL_STATUSES.DRAFT,
    currentVersion: 1,
    startDate: input.startDate,
    endDate: input.endDate,
    continuous: input.continuous,
  });

  let version;
  try {
    version = await ProtocolVersion.create({
      protocolId: protocol.id,
      version: 1,
      createdBy: requester.id,
      title: protocol.title,
      objective: protocol.objective,
      startDate: protocol.startDate,
      endDate: protocol.endDate,
      continuous: protocol.continuous,
      items,
    });
  } catch (error) {
    await Protocol.deleteOne({ _id: protocol.id });
    throw error;
  }

  return {
    protocol: toProtocolResponse(protocol),
    currentVersion: toVersionResponse(version),
  };
}

async function listProtocols(requester, query) {
  const filters = {};
  if (query.status) filters.status = query.status;
  if (query.athleteId) filters.athleteId = query.athleteId;
  if (query.professionalId) filters.professionalId = query.professionalId;
  if (query.dateFrom || query.dateTo) {
    filters.startDate = {};
    if (query.dateFrom) filters.startDate.$gte = query.dateFrom;
    if (query.dateTo) filters.startDate.$lte = query.dateTo;
  }

  if (requester.role === USER_ROLES.PROFESSIONAL) {
    const links = await ProfessionalAthleteLink.find({
      professionalId: requester.id,
      status: LINK_STATUSES.ACTIVE,
    }).select('athleteId');
    filters.professionalId = requester.id;
    filters.athleteId = {
      $in: links.map((link) => link.athleteId),
    };
  } else if (requester.role === USER_ROLES.ATHLETE) {
    filters.athleteId = requester.id;
  }

  if (query.substanceId) {
    const protocolIds = await ProtocolVersion.distinct('protocolId', {
      'items.substanceId': query.substanceId,
    });
    filters._id = { $in: protocolIds };
  }

  const skip = (query.page - 1) * query.limit;
  const sort = { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 };
  const [protocols, total] = await Promise.all([
    Protocol.find(filters).sort(sort).skip(skip).limit(query.limit),
    Protocol.countDocuments(filters),
  ]);

  return {
    protocols: protocols.map(toProtocolResponse),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

async function getProtocol(requester, protocolId) {
  const protocol = await getAccessibleProtocol(requester, protocolId);
  const currentVersion = await ProtocolVersion.findOne({
    protocolId: protocol.id,
    version: protocol.currentVersion,
  });
  if (!currentVersion) throw notFoundError('Versão');

  return {
    protocol: toProtocolResponse(protocol),
    currentVersion: toVersionResponse(currentVersion),
  };
}

async function updateProtocol(requester, protocolId, input) {
  const protocol = await getOwnedProtocol(requester, protocolId);
  if ([PROTOCOL_STATUSES.CLOSED, PROTOCOL_STATUSES.CANCELLED].includes(protocol.status)) {
    throw new AppError(
      422,
      ERROR_CODES.PROTOCOL_READ_ONLY,
      'O protocolo está disponível somente para leitura.',
    );
  }

  const currentVersion = await ProtocolVersion.findOne({
    protocolId: protocol.id,
    version: protocol.currentVersion,
  });
  if (!currentVersion) throw notFoundError('Versão');

  const nextValues = {
    title: input.title ?? protocol.title,
    objective:
      input.objective !== undefined ? input.objective || null : protocol.objective,
    startDate: input.startDate ?? protocol.startDate,
    endDate: input.endDate !== undefined ? input.endDate : protocol.endDate,
    continuous: input.continuous ?? protocol.continuous,
  };
  validateDateRange(
    nextValues.startDate,
    nextValues.endDate,
    nextValues.continuous,
  );

  const items = input.items
    ? await buildItems(input.items)
    : currentVersion.items.map((item) => item.toObject());

  if (protocol.status === PROTOCOL_STATUSES.DRAFT) {
    Object.assign(protocol, nextValues);
    Object.assign(currentVersion, {
      ...nextValues,
      items,
      changeReason: input.changeReason || currentVersion.changeReason,
    });
    await Promise.all([protocol.save(), currentVersion.save()]);
    return {
      protocol: toProtocolResponse(protocol),
      currentVersion: toVersionResponse(currentVersion),
    };
  }

  const nextVersionNumber = protocol.currentVersion + 1;
  let nextVersion;
  try {
    nextVersion = await ProtocolVersion.create({
      protocolId: protocol.id,
      version: nextVersionNumber,
      createdBy: requester.id,
      changeReason: input.changeReason || null,
      ...nextValues,
      items,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(
        409,
        ERROR_CODES.DUPLICATE_RESOURCE,
        'Conflito ao criar a próxima versão do protocolo.',
      );
    }
    throw error;
  }

  Object.assign(protocol, nextValues, { currentVersion: nextVersionNumber });
  try {
    await protocol.save();
  } catch (error) {
    await ProtocolVersion.deleteOne({ _id: nextVersion.id });
    throw error;
  }

  return {
    protocol: toProtocolResponse(protocol),
    currentVersion: toVersionResponse(nextVersion),
  };
}

async function transitionProtocol(requester, protocolId, action) {
  const protocol = await getOwnedProtocol(requester, protocolId);
  const now = new Date();

  if (action === 'activate') {
    if (
      ![PROTOCOL_STATUSES.DRAFT, PROTOCOL_STATUSES.PAUSED].includes(
        protocol.status,
      )
    ) {
      throw invalidTransitionError();
    }
    if (protocol.status === PROTOCOL_STATUSES.DRAFT) {
      const version = await ProtocolVersion.findOne({
        protocolId: protocol.id,
        version: protocol.currentVersion,
      });
      if (!version || !version.items.length) {
        throw new AppError(
          400,
          ERROR_CODES.PROTOCOL_EMPTY,
          'O protocolo precisa possuir ao menos um item para ser ativado.',
        );
      }
      protocol.activatedAt = now;
    }
    protocol.status = PROTOCOL_STATUSES.ACTIVE;
    protocol.pausedAt = null;
  } else if (action === 'pause') {
    if (protocol.status !== PROTOCOL_STATUSES.ACTIVE) {
      throw invalidTransitionError();
    }
    protocol.status = PROTOCOL_STATUSES.PAUSED;
    protocol.pausedAt = now;
  } else if (action === 'close') {
    if (
      ![PROTOCOL_STATUSES.ACTIVE, PROTOCOL_STATUSES.PAUSED].includes(
        protocol.status,
      )
    ) {
      throw invalidTransitionError();
    }
    protocol.status = PROTOCOL_STATUSES.CLOSED;
    protocol.closedAt = now;
  } else if (action === 'cancel') {
    if (protocol.status !== PROTOCOL_STATUSES.DRAFT) {
      throw invalidTransitionError(
        'Somente protocolos em rascunho podem ser cancelados.',
      );
    }
    protocol.status = PROTOCOL_STATUSES.CANCELLED;
    protocol.cancelledAt = now;
  }

  await protocol.save();
  return toProtocolResponse(protocol);
}

async function listVersions(requester, protocolId) {
  const protocol = await getAccessibleProtocol(requester, protocolId);
  const versions = await ProtocolVersion.find({ protocolId: protocol.id }).sort({
    version: 1,
  });
  return versions.map(toVersionResponse);
}

async function getVersion(requester, protocolId, versionNumber) {
  const protocol = await getAccessibleProtocol(requester, protocolId);
  const version = await ProtocolVersion.findOne({
    protocolId: protocol.id,
    version: versionNumber,
  });
  if (!version) throw notFoundError('Versão');
  return toVersionResponse(version);
}

module.exports = {
  createProtocol,
  getProtocol,
  getVersion,
  listProtocols,
  listVersions,
  transitionProtocol,
  updateProtocol,
};
