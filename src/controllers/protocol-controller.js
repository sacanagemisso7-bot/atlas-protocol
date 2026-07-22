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

async function createProtocolVersion(request, response) {
  const result = await protocolService.createProtocolVersion(
    request.user,
    request.params.id,
    request.body,
  );
  return response.status(201).json({
    success: true,
    data: result,
    message: 'Nova versão do protocolo criada com sucesso.',
  });
}

async function updateProtocolStatus(request, response) {
  const protocol = await protocolService.updateProtocolStatus(
    request.user,
    request.params.id,
    request.body,
  );
  return response.status(200).json({
    success: true,
    data: { protocol },
    message: 'Status do protocolo atualizado com sucesso.',
  });
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
    request.params.version,
  );
  return response.status(200).json({
    success: true,
    data: { version },
    message: 'Versão obtida com sucesso.',
  });
}

module.exports = {
  createProtocol,
  createProtocolVersion,
  getProtocol,
  getVersion,
  listProtocols,
  listVersions,
  updateProtocol,
  updateProtocolStatus,
};
