const ERROR_CODES = require('../constants/error-codes');
const PROFESSIONAL_VERIFICATION_STATUSES = require(
  '../constants/professional-verification-statuses',
);
const USER_ROLES = require('../constants/user-roles');
const ProfessionalProfile = require('../models/professional-profile');
const User = require('../models/user');
const AppError = require('../utils/app-error');
const toProfessionalVerificationResponse = require('../utils/professional-verification-response');

const SAFE_USER_FIELDS = 'name email role active';

function notFoundError() {
  return new AppError(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    'Verificação profissional não encontrada.',
  );
}

function alreadyReviewedError() {
  return new AppError(
    409,
    ERROR_CODES.PROFESSIONAL_ALREADY_REVIEWED,
    'Esta verificação profissional já foi analisada.',
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function populateProfessional(query) {
  return query.populate({ path: 'userId', select: SAFE_USER_FIELDS });
}

async function findProfessionalIds(search) {
  const expression = new RegExp(escapeRegExp(search), 'i');
  const professionals = await User.find({
    role: USER_ROLES.PROFESSIONAL,
    $or: [{ name: expression }, { email: expression }],
  })
    .select('_id')
    .lean();

  return professionals.map((professional) => professional._id);
}

async function listProfessionalVerifications({
  page = 1,
  limit = 20,
  status,
  search,
}) {
  const filters = {};
  if (status) filters.verificationStatus = status;
  if (search) filters.userId = { $in: await findProfessionalIds(search) };

  const skip = (page - 1) * limit;
  const [profiles, total] = await Promise.all([
    populateProfessional(
      ProfessionalProfile.find(filters)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
    ),
    ProfessionalProfile.countDocuments(filters),
  ]);

  return {
    verifications: profiles.map((profile) =>
      toProfessionalVerificationResponse(profile),
    ),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getOwnProfessionalVerification(userId) {
  const profile = await populateProfessional(
    ProfessionalProfile.findOne({ userId }),
  );
  if (!profile) throw notFoundError();

  return toProfessionalVerificationResponse(profile, {
    includeDocument: true,
  });
}

async function getProfessionalVerificationById(profileId) {
  const profile = await populateProfessional(
    ProfessionalProfile.findById(profileId),
  );
  if (!profile) throw notFoundError();

  return toProfessionalVerificationResponse(profile, {
    includeDocument: true,
  });
}

async function transitionPendingVerification(profileId, reviewerId, update) {
  const profile = await ProfessionalProfile.findOneAndUpdate(
    {
      _id: profileId,
      verificationStatus: PROFESSIONAL_VERIFICATION_STATUSES.PENDING,
    },
    {
      $set: {
        ...update,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    },
    { new: true, runValidators: true },
  );

  if (!profile) {
    const exists = await ProfessionalProfile.exists({ _id: profileId });
    if (!exists) throw notFoundError();
    throw alreadyReviewedError();
  }

  await profile.populate({ path: 'userId', select: SAFE_USER_FIELDS });
  return toProfessionalVerificationResponse(profile, {
    includeDocument: true,
  });
}

function approveProfessionalVerification(profileId, reviewerId) {
  return transitionPendingVerification(profileId, reviewerId, {
    verificationStatus: PROFESSIONAL_VERIFICATION_STATUSES.APPROVED,
    rejectionReason: null,
  });
}

function rejectProfessionalVerification(profileId, reviewerId, reason) {
  return transitionPendingVerification(profileId, reviewerId, {
    verificationStatus: PROFESSIONAL_VERIFICATION_STATUSES.REJECTED,
    rejectionReason: reason,
  });
}

module.exports = {
  approveProfessionalVerification,
  getOwnProfessionalVerification,
  getProfessionalVerificationById,
  listProfessionalVerifications,
  rejectProfessionalVerification,
};
