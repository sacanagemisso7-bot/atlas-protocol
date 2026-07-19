const substanceService = require('../services/substance-service');

async function createSubstance(request, response) {
  const substance = await substanceService.createSubstance(
    request.user,
    request.body,
  );
  return response.status(201).json({
    success: true,
    data: { substance },
    message: 'Substância criada com sucesso.',
  });
}

async function listSubstances(request, response) {
  const { substances, meta } = await substanceService.listSubstances(
    request.query,
  );
  return response.status(200).json({ success: true, data: substances, meta });
}

async function getSubstance(request, response) {
  const substance = await substanceService.getSubstanceById(request.params.id);
  return response.status(200).json({
    success: true,
    data: { substance },
    message: 'Substância obtida com sucesso.',
  });
}

async function updateSubstance(request, response) {
  const substance = await substanceService.updateSubstance(
    request.params.id,
    request.body,
  );
  return response.status(200).json({
    success: true,
    data: { substance },
    message: 'Substância atualizada com sucesso.',
  });
}

async function updateSubstanceStatus(request, response) {
  const substance = await substanceService.updateSubstanceStatus(
    request.params.id,
    request.body.active,
  );
  return response.status(200).json({
    success: true,
    data: { substance },
    message: 'Status da substância atualizado com sucesso.',
  });
}

module.exports = {
  createSubstance,
  getSubstance,
  listSubstances,
  updateSubstance,
  updateSubstanceStatus,
};
