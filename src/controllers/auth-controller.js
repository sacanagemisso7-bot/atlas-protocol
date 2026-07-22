const authService = require('../services/auth-service');

async function register(request, response) {
  const result = await authService.register(request.body);

  return response.status(201).json({
    success: true,
    data: result,
    message: 'Cadastro realizado com sucesso.',
  });
}

async function registerProfessional(request, response) {
  const result = await authService.registerProfessional(
    request.body,
    request.file,
  );

  return response.status(201).json({
    success: true,
    data: result,
    message: 'Cadastro enviado para análise.',
  });
}

async function login(request, response) {
  const result = await authService.login(request.body);

  return response.status(200).json({
    success: true,
    data: result,
    message: 'Login realizado com sucesso.',
  });
}

async function me(request, response) {
  const user = await authService.getCurrentUser(request.user.id);

  return response.status(200).json({
    success: true,
    data: { user },
    message: 'Usuário autenticado obtido com sucesso.',
  });
}

async function changePassword(request, response) {
  const user = await authService.changePassword(request.user.id, request.body);

  return response.status(200).json({
    success: true,
    data: { user },
    message: 'Senha alterada com sucesso.',
  });
}

module.exports = {
  changePassword,
  login,
  me,
  register,
  registerProfessional,
};
