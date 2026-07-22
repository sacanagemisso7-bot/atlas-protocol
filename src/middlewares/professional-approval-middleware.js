const ERROR_CODES = require('../constants/error-codes');
const PROFESSIONAL_VERIFICATION_STATUSES = require(
  '../constants/professional-verification-statuses'
);
const USER_ROLES = require('../constants/user-roles');
const ProfessionalProfile = require('../models/professional-profile');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');

const professionalApprovalMiddleware = asyncHandler(
  async (request, _response, next) => {
    if (!request.user || request.user.role !== USER_ROLES.PROFESSIONAL) {
      return next();
    }

    const profile = await ProfessionalProfile.findOne({
      userId: request.user.id,
    });

    if (!profile) {
      throw new AppError(
        403,
        ERROR_CODES.PROFESSIONAL_VERIFICATION_REQUIRED,
        'Verificação profissional necessária.',
      );
    }

    if (
      profile.verificationStatus === PROFESSIONAL_VERIFICATION_STATUSES.PENDING
    ) {
      throw new AppError(
        403,
        ERROR_CODES.PROFESSIONAL_PENDING_APPROVAL,
        'Cadastro profissional aguardando aprovação.',
      );
    }

    if (
      profile.verificationStatus === PROFESSIONAL_VERIFICATION_STATUSES.REJECTED
    ) {
      throw new AppError(
        403,
        ERROR_CODES.PROFESSIONAL_REJECTED,
        'Cadastro profissional rejeitado.',
      );
    }

    if (
      profile.verificationStatus !== PROFESSIONAL_VERIFICATION_STATUSES.APPROVED
    ) {
      throw new AppError(
        403,
        ERROR_CODES.PROFESSIONAL_VERIFICATION_REQUIRED,
        'Verificação profissional necessária.',
      );
    }

    request.professionalProfile = profile;
    return next();
  },
);

module.exports = professionalApprovalMiddleware;
