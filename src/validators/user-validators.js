const Joi = require('joi');

const USER_ROLES = require('../constants/user-roles');

const objectIdPattern = /^[a-f\d]{24}$/i;

const userIdParamsSchema = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required().messages({
    'any.required': 'Informe o identificador do usuário.',
    'string.pattern.base': 'Informe um ObjectId válido.',
  }),
}).unknown(false);

const userListQuerySchema = Joi.object({
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
  role: Joi.string().valid(...Object.values(USER_ROLES)).messages({
    'any.only': 'Informe um perfil válido.',
  }),
  active: Joi.boolean().messages({
    'boolean.base': 'O filtro active deve ser booleano.',
  }),
  search: Joi.string().trim().min(1).max(120).messages({
    'string.empty': 'A busca não pode ser vazia.',
    'string.max': 'A busca deve possuir no máximo 120 caracteres.',
  }),
}).unknown(false);

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).messages({
    'string.empty': 'Informe o nome.',
    'string.max': 'O nome deve possuir no máximo 120 caracteres.',
    'string.min': 'O nome deve possuir pelo menos 2 caracteres.',
  }),
  role: Joi.string().valid(...Object.values(USER_ROLES)).messages({
    'any.only': 'Informe um perfil válido.',
  }),
  active: Joi.boolean().messages({
    'boolean.base': 'O status active deve ser booleano.',
  }),
})
  .min(1)
  .unknown(false)
  .messages({
    'object.min': 'Informe ao menos um campo para atualização.',
  });

const blockUserSchema = Joi.object({
  blocked: Joi.boolean().required().messages({
    'any.required': 'Informe o status de bloqueio.',
    'boolean.base': 'O status blocked deve ser booleano.',
  }),
}).unknown(false);

module.exports = {
  blockUserSchema,
  updateUserSchema,
  userIdParamsSchema,
  userListQuerySchema,
};
