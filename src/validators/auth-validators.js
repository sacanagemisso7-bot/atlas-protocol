const Joi = require('joi');

const email = Joi.string().trim().lowercase().email().required().messages({
  'any.required': 'Informe o e-mail.',
  'string.email': 'Informe um e-mail válido.',
  'string.empty': 'Informe o e-mail.',
});

const password = Joi.string().min(8).max(72).required().messages({
  'any.required': 'Informe a senha.',
  'string.empty': 'Informe a senha.',
  'string.max': 'A senha deve possuir no máximo 72 caracteres.',
  'string.min': 'A senha deve possuir pelo menos 8 caracteres.',
});

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required().messages({
    'any.required': 'Informe o nome.',
    'string.empty': 'Informe o nome.',
    'string.max': 'O nome deve possuir no máximo 120 caracteres.',
    'string.min': 'O nome deve possuir pelo menos 2 caracteres.',
  }),
  email,
  password,
}).unknown(false);

const loginSchema = Joi.object({
  email,
  password: Joi.string().max(72).required().messages({
    'any.required': 'Informe a senha.',
    'string.empty': 'Informe a senha.',
    'string.max': 'A senha deve possuir no máximo 72 caracteres.',
  }),
}).unknown(false);

const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().max(72).required().messages({
    'any.required': 'Informe a senha atual.',
    'string.empty': 'Informe a senha atual.',
    'string.max': 'A senha atual deve possuir no máximo 72 caracteres.',
  }),
  newPassword: password,
}).unknown(false);

module.exports = { loginSchema, passwordChangeSchema, registerSchema };
