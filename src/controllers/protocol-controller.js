const protocolService = require('../services/protocol-service');

async function createProtocol(request, response) {
  const result = await protocolService.createProtocol(request.user, request.body);
  return response.status(201).json({
    success: true,
    data: result,
    message: 'Protocolo criado com sucesso.',
  });
}

async function listProtocols(request, response) {
  const { protocols, meta } = await protocolService.listProtocols(
    request.user,
    request.query,
  );
  return response.status(200).json({ success: true, data: protocols, meta });
}

async function getProtocol(request, response) {
  const result = await protocolService.getProtocol(
    request.user,
    request.params.id,
  );
  return response.status(200).json({
    success: true,
    data: result,
    message: 'Protocolo obtido com sucesso.',
  });
}

async function updateProtocol(request, response) {
  const result = await protocolService.updateProtocol(
    request.user,
    request.params.id,
    request.body,
  );
  return response.status(200).json({
    success: true,
    data: result,
    message: 'Protocolo atualizado com sucesso.',
  });
}

function transition(action, message) {
  return async (request, response) => {
    const protocol = await protocolService.transitionProtocol(
      request.user,
      request.params.id,
      action,
    );
    return response.status(200).json({
      success: true,
      data: { protocol },
      message,
    });
  };
}

async function listVersions(request, response) {
  const versions = await protocolService.listVersions(
    request.user,
    request.params.id,
  );
  return response.status(200).json({
    success: true,
    data: versions,
  });
}

async function getVersion(request, response) {
  const version = await protocolService.getVersion(
    request.user,
    request.params.id,
    request.params.versionNumber,
  );
  return response.status(200).json({
    success: true,
    data: { version },
    message: 'Versão obtida com sucesso.',
  });
}

module.exports = {
  activateProtocol: transition('activate', 'Protocolo ativado com sucesso.'),
  cancelProtocol: transition('cancel', 'Protocolo cancelado com sucesso.'),
  closeProtocol: transition('close', 'Protocolo encerrado com sucesso.'),
  createProtocol,
  getProtocol,
  getVersion,
  listProtocols,
  listVersions,
  pauseProtocol: transition('pause', 'Protocolo pausado com sucesso.'),
  updateProtocol,
};
