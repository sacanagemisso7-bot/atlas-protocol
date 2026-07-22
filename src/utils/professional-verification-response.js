const PROFESSIONAL_VERIFICATION_STATUSES = require('../constants/professional-verification-statuses');

function toId(value) {
  if (!value) return null;
  if (value._id) return value._id.toString();
  if (typeof value.id === 'string') return value.id;
  return value.toString();
}

function toSafeProfessional(user) {
  if (!user || user.name === undefined) return null;

  return {
    id: toId(user),
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

function toSafeDocument(document) {
  if (!document) return null;

  return {
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
  };
}

function toProfessionalVerificationResponse(
  professionalProfile,
  { includeDocument = false } = {},
) {
  const professional = toSafeProfessional(professionalProfile.userId);
  const response = {
    id: toId(professionalProfile),
    userId: professional
      ? professional.id
      : toId(professionalProfile.userId),
    user: professional,
    verificationStatus: professionalProfile.verificationStatus,
    submittedAt: professionalProfile.submittedAt,
    reviewedAt: professionalProfile.reviewedAt,
    reviewedBy: toId(professionalProfile.reviewedBy),
    createdAt: professionalProfile.createdAt,
    updatedAt: professionalProfile.updatedAt,
  };

  if (
    professionalProfile.verificationStatus ===
    PROFESSIONAL_VERIFICATION_STATUSES.REJECTED
  ) {
    response.rejectionReason = professionalProfile.rejectionReason;
  }

  if (includeDocument) {
    response.verificationDocument = toSafeDocument(
      professionalProfile.verificationDocument,
    );
  }

  return response;
}

module.exports = toProfessionalVerificationResponse;
