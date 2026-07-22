const Joi = require('joi');

const PROFESSIONAL_VERIFICATION_STATUSES = require(
  '../constants/professional-verification-statuses',
);

const objectIdPattern = /^[a-f\d]{24}$/i;

const professionalVerificationIdParamsSchema = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required().messages({
    'any.required': 'Informe a verificação profissional.',
    'string.pattern.base':
      'Informe um identificador de verificação profissional válido.',
  }),
}).unknown(false);

const professionalVerificationListQuerySchema = Joi.object({
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
  status: Joi.string()
    .valid(...Object.values(PROFESSIONAL_VERIFICATION_STATUSES))
    .messages({
      'any.only': 'Informe um status de verificação válido.',
    }),
  search: Joi.string().trim().min(1).max(120).messages({
    'string.empty': 'A busca não pode ser vazia.',
    'string.max': 'A busca deve possuir no máximo 120 caracteres.',
  }),
}).unknown(false);

const approveProfessionalVerificationSchema = Joi.object({}).unknown(false);

const rejectProfessionalVerificationSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required().messages({
    'any.required': 'Informe o motivo da rejeição.',
    'string.empty': 'Informe o motivo da rejeição.',
    'string.max': 'O motivo deve possuir no máximo 1000 caracteres.',
  }),
}).unknown(false);

module.exports = {
  approveProfessionalVerificationSchema,
  professionalVerificationIdParamsSchema,
  professionalVerificationListQuerySchema,
  rejectProfessionalVerificationSchema,
};
