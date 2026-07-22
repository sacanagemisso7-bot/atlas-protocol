const Joi = require('joi');

const TRACKING_RECORD_STATUSES = require('../constants/tracking-record-statuses');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Informe um ObjectId válido.' });

const nullableObjectId = objectId.allow(null);
const nullableDate = Joi.date().iso().allow(null);
const nullableNotes = Joi.string().trim().max(2000).allow(null, '');

const trackingRecordFields = {
  protocolId: nullableObjectId,
  title: Joi.string().trim().min(3).max(160),
  scheduledFor: Joi.date().iso(),
  notes: nullableNotes,
};

const createTrackingRecordSchema = Joi.object({
  athleteId: objectId,
  protocolId: trackingRecordFields.protocolId,
  title: trackingRecordFields.title.required().messages({
    'any.required': 'Informe o título.',
    'string.empty': 'Informe o título.',
  }),
  scheduledFor: trackingRecordFields.scheduledFor.required().messages({
    'any.required': 'Informe a data agendada.',
  }),
  notes: trackingRecordFields.notes,
}).unknown(false);

const updateTrackingRecordSchema = Joi.object(trackingRecordFields)
  .min(1)
  .messages({
    'object.min': 'Informe ao menos um campo para atualização.',
  })
  .unknown(false);

const transitionTrackingRecordSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(TRACKING_RECORD_STATUSES))
    .required()
    .messages({
      'any.required': 'Informe o status.',
      'any.only': 'Informe um status válido.',
    }),
  completedAt: nullableDate,
  notes: nullableNotes,
}).unknown(false);

const trackingRecordIdParamsSchema = Joi.object({
  id: objectId.required().messages({
    'any.required': 'Informe o registro de acompanhamento.',
  }),
}).unknown(false);

const trackingRecordListQuerySchema = Joi.object({
  athleteId: objectId,
  professionalId: objectId,
  protocolId: objectId,
  status: Joi.string().valid(...Object.values(TRACKING_RECORD_STATUSES)),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('scheduledFor', 'createdAt', 'updatedAt', 'status')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
})
  .custom((value, helpers) => {
    if (
      value.dateFrom &&
      value.dateTo &&
      new Date(value.dateTo) < new Date(value.dateFrom)
    ) {
      return helpers.error('query.invalidDateRange');
    }
    return value;
  })
  .messages({
    'query.invalidDateRange': 'dateTo não pode ser anterior a dateFrom.',
  })
  .unknown(false);

module.exports = {
  createTrackingRecordSchema,
  trackingRecordIdParamsSchema,
  trackingRecordListQuerySchema,
  transitionTrackingRecordSchema,
  updateTrackingRecordSchema,
};
