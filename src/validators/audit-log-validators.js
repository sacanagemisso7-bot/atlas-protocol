const Joi = require('joi');

const AUDIT_ACTIONS = require('../constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../constants/audit-entity-types');

const objectId = Joi.string().pattern(/^[a-f\d]{24}$/i).messages({
  'string.pattern.base': 'Informe um ObjectId válido.',
});

const isoDate = Joi.date().iso().messages({
  'date.base': 'Informe uma data válida.',
  'date.format': 'Informe uma data no formato ISO 8601.',
});

const auditLogListQuerySchema = Joi.object({
  actorId: objectId,
  entityType: Joi.string()
    .valid(...Object.values(AUDIT_ENTITY_TYPES))
    .messages({
      'any.only': 'Informe um tipo de entidade auditável válido.',
    }),
  entityId: objectId,
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .messages({
      'any.only': 'Informe uma ação de auditoria válida.',
    }),
  dateFrom: isoDate,
  dateTo: isoDate.when('dateFrom', {
    is: Joi.exist(),
    then: isoDate.min(Joi.ref('dateFrom')).messages({
      'date.min': 'A data final deve ser maior ou igual à data inicial.',
    }),
  }),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'A página deve ser um número.',
    'number.integer': 'A página deve ser um número inteiro.',
    'number.min': 'A página deve ser maior ou igual a 1.',
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'O limite deve ser um número.',
    'number.integer': 'O limite deve ser um número inteiro.',
    'number.max': 'O limite deve ser menor ou igual a 100.',
    'number.min': 'O limite deve ser maior ou igual a 1.',
  }),
}).unknown(false);

module.exports = { auditLogListQuerySchema };
