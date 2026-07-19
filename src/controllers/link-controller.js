const linkService = require('../services/link-service');

async function createLink(request, response) {
  const link = await linkService.createLink(request.user, request.body);

  return response.status(201).json({
    success: true,
    data: { link },
    message: 'Vínculo criado com sucesso.',
  });
}

async function listLinks(request, response) {
  const { links, meta } = await linkService.listLinks(
    request.user,
    request.query,
  );

  return response.status(200).json({
    success: true,
    data: links,
    meta,
  });
}

async function getLink(request, response) {
  const link = await linkService.getLinkById(request.user, request.params.id);

  return response.status(200).json({
    success: true,
    data: { link },
    message: 'Vínculo obtido com sucesso.',
  });
}

async function endLink(request, response) {
  const link = await linkService.endLink(request.user, request.params.id);

  return response.status(200).json({
    success: true,
    data: { link },
    message: 'Vínculo encerrado com sucesso.',
  });
}

module.exports = { createLink, endLink, getLink, listLinks };
