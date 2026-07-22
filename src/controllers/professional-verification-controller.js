const professionalVerificationService = require('../services/professional-verification-service');

async function listProfessionalVerifications(request, response) {
  const { verifications, meta } =
    await professionalVerificationService.listProfessionalVerifications(
      request.query,
    );

  return response.status(200).json({
    success: true,
    data: verifications,
    meta,
  });
}

async function getOwnProfessionalVerification(request, response) {
  const verification =
    await professionalVerificationService.getOwnProfessionalVerification(
      request.user.id,
    );

  return response.status(200).json({
    success: true,
    data: { verification },
    message: 'Verificação profissional obtida com sucesso.',
  });
}

async function getProfessionalVerification(request, response) {
  const verification =
    await professionalVerificationService.getProfessionalVerificationById(
      request.params.id,
    );

  return response.status(200).json({
    success: true,
    data: { verification },
    message: 'Verificação profissional obtida com sucesso.',
  });
}

async function approveProfessionalVerification(request, response) {
  const verification =
    await professionalVerificationService.approveProfessionalVerification(
      request.params.id,
      request.user.id,
    );

  return response.status(200).json({
    success: true,
    data: { verification },
    message: 'Profissional aprovado com sucesso.',
  });
}

async function rejectProfessionalVerification(request, response) {
  const verification =
    await professionalVerificationService.rejectProfessionalVerification(
      request.params.id,
      request.user.id,
      request.body.reason,
    );

  return response.status(200).json({
    success: true,
    data: { verification },
    message: 'Profissional rejeitado com sucesso.',
  });
}

module.exports = {
  approveProfessionalVerification,
  getOwnProfessionalVerification,
  getProfessionalVerification,
  listProfessionalVerifications,
  rejectProfessionalVerification,
};
