const trackingRecordService = require('../services/tracking-record-service');

async function createTrackingRecord(request, response) {
  const trackingRecord = await trackingRecordService.createTrackingRecord(
    request.user,
    request.body,
  );

  return response.status(201).json({
    success: true,
    data: { trackingRecord },
    message: 'Registro de acompanhamento criado com sucesso.',
  });
}

async function listTrackingRecords(request, response) {
  const { records, meta } = await trackingRecordService.listTrackingRecords(
    request.user,
    request.query,
  );

  return response.status(200).json({
    success: true,
    data: records,
    meta,
  });
}

async function getTrackingRecord(request, response) {
  const trackingRecord = await trackingRecordService.getTrackingRecord(
    request.user,
    request.params.id,
  );

  return response.status(200).json({
    success: true,
    data: { trackingRecord },
    message: 'Registro de acompanhamento obtido com sucesso.',
  });
}

async function updateTrackingRecord(request, response) {
  const trackingRecord = await trackingRecordService.updateTrackingRecord(
    request.user,
    request.params.id,
    request.body,
  );

  return response.status(200).json({
    success: true,
    data: { trackingRecord },
    message: 'Registro de acompanhamento atualizado com sucesso.',
  });
}

async function transitionTrackingRecord(request, response) {
  const trackingRecord = await trackingRecordService.transitionTrackingRecord(
    request.user,
    request.params.id,
    request.body,
  );

  return response.status(200).json({
    success: true,
    data: { trackingRecord },
    message: 'Status do registro de acompanhamento atualizado com sucesso.',
  });
}

module.exports = {
  createTrackingRecord,
  getTrackingRecord,
  listTrackingRecords,
  transitionTrackingRecord,
  updateTrackingRecord,
};
