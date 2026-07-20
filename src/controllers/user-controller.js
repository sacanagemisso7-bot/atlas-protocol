const userService = require('../services/user-service');

async function listUsers(request, response) {
  const { users, meta } = await userService.listUsers(request.query);

  return response.status(200).json({
    success: true,
    data: users,
    meta,
  });
}

async function getUser(request, response) {
  const user = await userService.getUserById(request.user, request.params.id);

  return response.status(200).json({
    success: true,
    data: { user },
    message: 'Usuário obtido com sucesso.',
  });
}

async function updateUser(request, response) {
  const user = await userService.updateUser(
    request.user,
    request.params.id,
    request.body,
  );

  return response.status(200).json({
    success: true,
    data: { user },
    message: 'Usuário atualizado com sucesso.',
  });
}

async function setUserBlocked(request, response) {
  const user = await userService.setUserBlocked(
    request.user,
    request.params.id,
    request.body.blocked,
  );

  return response.status(200).json({
    success: true,
    data: { user },
    message: request.body.blocked
      ? 'Usuário bloqueado com sucesso.'
      : 'Usuário desbloqueado com sucesso.',
  });
}

module.exports = { getUser, listUsers, setUserBlocked, updateUser };
