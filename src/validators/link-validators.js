const Joi = require('joi');

const LINK_STATUSES = require('../constants/link-statuses');

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .required()
  .messages({
    'any.required': 'Informe o identificador.',
    'string.pattern.base': 'Informe um ObjectId válido.',
  });

const createLinkSchema = Joi.object({
  professionalId: objectId.messages({
    'any.required': 'Informe o profissional.',
    'string.pattern.base': 'Informe um professionalId válido.',
  }),
  athleteId: objectId.messages({
    'any.required': 'Informe o atleta.',
    'string.pattern.base': 'Informe um athleteId válido.',
  }),
}).unknown(false);

const linkIdParamsSchema = Joi.object({
  id: objectId.messages({
    'any.required': 'Informe o vínculo.',
    'string.pattern.base': 'Informe um identificador de vínculo válido.',
  }),
}).unknown(false);

const linkListQuerySchema = Joi.object({
  status: Joi.string().valid(...Object.values(LINK_STATUSES)).messages({
    'any.only': 'Informe um status válido.',
  }),
  professionalId: objectId.optional(),
  athleteId: objectId.optional(),
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

const endLinkSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    'any.required': 'Informe o motivo do encerramento.',
    'string.empty': 'Informe o motivo do encerramento.',
    'string.max': 'O motivo deve possuir no máximo 500 caracteres.',
    'string.min': 'O motivo deve possuir pelo menos 3 caracteres.',
  }),
}).unknown(false);

module.exports = {
  createLinkSchema,
  endLinkSchema,
  linkIdParamsSchema,
  linkListQuerySchema,
};
