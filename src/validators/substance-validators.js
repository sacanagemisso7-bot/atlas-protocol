const Joi = require('joi');

const SUBSTANCE_CATEGORIES = require('../constants/substance-categories');
const SUBSTANCE_UNITS = require('../constants/substance-units');

const name = Joi.string().trim().min(2).max(120).messages({
  'any.required': 'Informe o nome.',
  'string.empty': 'Informe o nome.',
  'string.max': 'O nome deve possuir no máximo 120 caracteres.',
  'string.min': 'O nome deve possuir pelo menos 2 caracteres.',
});

const description = Joi.string().trim().max(1000).allow(null, '').messages({
  'string.max': 'A descrição deve possuir no máximo 1000 caracteres.',
});

const category = Joi.string()
  .valid(...Object.values(SUBSTANCE_CATEGORIES))
  .messages({
    'any.only': 'Informe uma categoria válida.',
  });

const defaultUnit = Joi.string()
  .valid(...Object.values(SUBSTANCE_UNITS))
  .allow(null)
  .messages({
    'any.only': 'Informe uma unidade padrão válida.',
  });

const createSubstanceSchema = Joi.object({
  name: name.required(),
  description,
  category: category.required(),
  defaultUnit,
}).unknown(false);

const updateSubstanceSchema = Joi.object({
  name,
  description,
  category,
  defaultUnit,
})
  .min(1)
  .unknown(false)
  .messages({
    'object.min': 'Informe ao menos um campo para atualização.',
  });

const updateSubstanceStatusSchema = Joi.object({
  active: Joi.boolean().required().messages({
    'any.required': 'Informe o status da substância.',
    'boolean.base': 'O status active deve ser booleano.',
  }),
}).unknown(false);

const substanceIdParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'any.required': 'Informe a substância.',
      'string.pattern.base': 'Informe um identificador de substância válido.',
    }),
}).unknown(false);

const substanceListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().min(1).max(120),
  category,
  active: Joi.boolean(),
  sortBy: Joi.string().valid('name', 'createdAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).unknown(false);

module.exports = {
  createSubstanceSchema,
  substanceIdParamsSchema,
  substanceListQuerySchema,
  updateSubstanceSchema,
  updateSubstanceStatusSchema,
};
