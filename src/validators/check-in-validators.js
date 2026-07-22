const Joi = require('joi');

const CHECK_IN_STATUSES = require('../constants/check-in-statuses');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Informe um ObjectId válido.' });

const nullableObjectId = objectId.allow(null);

const answerFields = {
  weightKg: Joi.number().greater(0).allow(null),
  sleepHours: Joi.number().min(0).max(24).allow(null),
  energyScore: Joi.number().min(0).max(10).allow(null),
  adherenceScore: Joi.number().min(0).max(10).allow(null),
  reportedEffects: Joi.array()
    .items(Joi.string().trim().min(1).max(500))
    .max(20),
  notes: Joi.string().trim().max(2000).allow(null, ''),
};

const createAnswersSchema = Joi.object(answerFields).unknown(false).default({});
const updateAnswersSchema = Joi.object(answerFields)
  .min(1)
  .messages({
    'object.min': 'Informe ao menos uma resposta para atualização.',
  })
  .unknown(false);

const createCheckInSchema = Joi.object({
  athleteId: objectId,
  protocolId: nullableObjectId,
  referenceWeek: Joi.date().iso().required().messages({
    'any.required': 'Informe a semana de referência.',
  }),
  answers: createAnswersSchema,
}).unknown(false);

const updateCheckInSchema = Joi.object({
  protocolId: nullableObjectId,
  referenceWeek: Joi.date().iso(),
  answers: updateAnswersSchema,
})
  .min(1)
  .messages({
    'object.min': 'Informe ao menos um campo para atualização.',
  })
  .unknown(false);

const submitCheckInSchema = Joi.object({}).unknown(false);

const reviewCheckInSchema = Joi.object({
  reviewComment: Joi.string().trim().max(2000).required().messages({
    'any.required': 'Informe o comentário da revisão.',
    'string.empty': 'Informe o comentário da revisão.',
  }),
}).unknown(false);

const checkInIdParamsSchema = Joi.object({
  id: objectId.required().messages({
    'any.required': 'Informe o check-in.',
  }),
}).unknown(false);

const checkInListQuerySchema = Joi.object({
  athleteId: objectId,
  protocolId: objectId,
  status: Joi.string().valid(...Object.values(CHECK_IN_STATUSES)),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('createdAt', 'submittedAt', 'reviewedAt', 'status')
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
  checkInIdParamsSchema,
  checkInListQuerySchema,
  createCheckInSchema,
  reviewCheckInSchema,
  submitCheckInSchema,
  updateCheckInSchema,
};
