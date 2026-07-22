const mongoose = require('mongoose');

const AUDIT_ACTIONS = require('../constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../constants/audit-entity-types');
const AuditLog = require('../models/audit-log');

const MAX_METADATA_BYTES = 4096;
const MAX_METADATA_DEPTH = 3;
const MAX_METADATA_ENTRIES = 50;
const MAX_ARRAY_LENGTH = 20;
const MAX_KEY_LENGTH = 80;
const MAX_STRING_LENGTH = 500;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'buffer',
  'constructor',
  'document',
  'examcontent',
  'examdocument',
  'filepath',
  'internalpath',
  'jwt',
  'path',
  'pdf',
  'prototype',
  'proto',
  'secret',
  'storagekey',
  'token',
  'url',
]);

function auditValidationError(message) {
  return new TypeError(`AuditLog inválido: ${message}`);
}

function normalizeKey(key) {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isSensitiveKey(key) {
  const normalizedKey = normalizeKey(key);

  return (
    SENSITIVE_KEYS.has(normalizedKey) ||
    normalizedKey.includes('password') ||
    normalizedKey.endsWith('token') ||
    normalizedKey.includes('secret') ||
    normalizedKey.endsWith('buffer') ||
    normalizedKey.endsWith('storagekey') ||
    normalizedKey.endsWith('filepath') ||
    normalizedKey.endsWith('internalpath')
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeValue(value, context, depth) {
  if (depth > MAX_METADATA_DEPTH) {
    throw auditValidationError(
      `metadata deve possuir no máximo ${MAX_METADATA_DEPTH} níveis.`,
    );
  }

  if (value === null || typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      throw auditValidationError(
        `strings de metadata devem possuir no máximo ${MAX_STRING_LENGTH} caracteres.`,
      );
    }
    return value.trim();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw auditValidationError('metadata contém um número inválido.');
    }
    return value;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw auditValidationError('metadata contém uma data inválida.');
    }
    return value.toISOString();
  }

  if (value instanceof mongoose.Types.ObjectId) return value.toString();

  if (Buffer.isBuffer(value)) {
    throw auditValidationError('buffers não são permitidos em metadata.');
  }

  if (typeof value !== 'object') {
    throw auditValidationError('metadata contém um tipo não permitido.');
  }

  if (context.seen.has(value)) {
    throw auditValidationError('metadata não pode possuir referências circulares.');
  }
  context.seen.add(value);

  let sanitizedValue;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw auditValidationError(
        `arrays de metadata devem possuir no máximo ${MAX_ARRAY_LENGTH} itens.`,
      );
    }
    sanitizedValue = value.map((item) =>
      sanitizeValue(item, context, depth + 1),
    );
  } else {
    if (!isPlainObject(value)) {
      throw auditValidationError('metadata deve conter somente objetos simples.');
    }

    sanitizedValue = {};
    for (const [key, item] of Object.entries(value)) {
      context.entries += 1;
      if (context.entries > MAX_METADATA_ENTRIES) {
        throw auditValidationError(
          `metadata deve possuir no máximo ${MAX_METADATA_ENTRIES} campos.`,
        );
      }
      if (!key || key.length > MAX_KEY_LENGTH || !/^[a-zA-Z][\w-]*$/.test(key)) {
        throw auditValidationError('metadata contém um nome de campo inválido.');
      }
      if (isSensitiveKey(key)) {
        throw auditValidationError(
          `o campo sensível "${key}" não é permitido em metadata.`,
        );
      }
      sanitizedValue[key] = sanitizeValue(item, context, depth + 1);
    }
  }

  context.seen.delete(value);
  return sanitizedValue;
}

function sanitizeMetadata(metadata = {}) {
  if (!isPlainObject(metadata)) {
    throw auditValidationError('metadata deve ser um objeto simples.');
  }

  const sanitized = sanitizeValue(
    metadata,
    { entries: 0, seen: new WeakSet() },
    0,
  );
  const serialized = JSON.stringify(sanitized);

  if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw auditValidationError(
      `metadata deve possuir no máximo ${MAX_METADATA_BYTES} bytes.`,
    );
  }

  return sanitized;
}

function normalizeObjectId(value, field, nullable = true) {
  if (value === null || value === undefined) {
    if (nullable) return null;
    throw auditValidationError(`${field} é obrigatório.`);
  }

  if (!mongoose.isObjectIdOrHexString(value)) {
    throw auditValidationError(`${field} deve ser um ObjectId válido.`);
  }

  return new mongoose.Types.ObjectId(value);
}

function validateEnum(value, allowedValues, field) {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw auditValidationError(`${field} é inválido.`);
  }
  return value;
}

function normalizeIpHash(ipHash) {
  if (ipHash === null || ipHash === undefined) return null;
  if (typeof ipHash !== 'string') {
    throw auditValidationError('ipHash deve ser uma string.');
  }

  const normalized = ipHash.trim();
  if (!normalized || normalized.length > 128) {
    throw auditValidationError('ipHash deve possuir entre 1 e 128 caracteres.');
  }
  return normalized;
}

async function record({
  actorId = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
  ipHash = null,
}) {
  const auditLog = await AuditLog.create({
    actorId: normalizeObjectId(actorId, 'actorId'),
    action: validateEnum(action, Object.values(AUDIT_ACTIONS), 'action'),
    entityType: validateEnum(
      entityType,
      Object.values(AUDIT_ENTITY_TYPES),
      'entityType',
    ),
    entityId: normalizeObjectId(entityId, 'entityId'),
    metadata: sanitizeMetadata(metadata),
    ipHash: normalizeIpHash(ipHash),
  });

  return auditLog;
}

async function listAuditLogs({
  actorId,
  entityType,
  entityId,
  action,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
}) {
  const filters = {};
  if (actorId) filters.actorId = actorId;
  if (entityType) filters.entityType = entityType;
  if (entityId) filters.entityId = entityId;
  if (action) filters.action = action;
  if (dateFrom || dateTo) {
    filters.createdAt = {};
    if (dateFrom) filters.createdAt.$gte = dateFrom;
    if (dateTo) filters.createdAt.$lte = dateTo;
  }

  const skip = (page - 1) * limit;
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(filters)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filters),
  ]);

  return {
    auditLogs: auditLogs.map((auditLog) => {
      const serialized = auditLog.toJSON();
      return {
        ...serialized,
        metadata: sanitizeMetadata(serialized.metadata),
      };
    }),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = { listAuditLogs, record, sanitizeMetadata };
