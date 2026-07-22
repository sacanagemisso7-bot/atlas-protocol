const mongoose = require('mongoose');

const PROFESSIONAL_VERIFICATION_STATUSES = require(
  '../constants/professional-verification-statuses'
);

const verificationDocumentSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true, select: false },
    url: { type: String, required: true, select: false },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['application/pdf'],
    },
    sizeBytes: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const professionalProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(PROFESSIONAL_VERIFICATION_STATUSES),
      default: PROFESSIONAL_VERIFICATION_STATUSES.PENDING,
      required: true,
    },
    verificationDocument: {
      type: verificationDocumentSchema,
      required: true,
    },
    submittedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
  },
  {
    collection: 'professional_profiles',
    timestamps: true,
    toJSON: {
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;

        if (returnedObject.verificationDocument) {
          delete returnedObject.verificationDocument.storageKey;
          delete returnedObject.verificationDocument.url;
        }

        return returnedObject;
      },
    },
  },
);

professionalProfileSchema.pre('validate', function validateReviewState(next) {
  const status = this.verificationStatus;
  const isPending = status === PROFESSIONAL_VERIFICATION_STATUSES.PENDING;
  const isApproved = status === PROFESSIONAL_VERIFICATION_STATUSES.APPROVED;
  const isRejected = status === PROFESSIONAL_VERIFICATION_STATUSES.REJECTED;

  if (isPending && (this.reviewedAt || this.reviewedBy)) {
    this.invalidate(
      'verificationStatus',
      'Uma verificação pendente não pode possuir dados de revisão.',
    );
  }

  if (isPending && this.rejectionReason !== null) {
    this.invalidate(
      'rejectionReason',
      'Uma verificação pendente não pode possuir motivo de rejeição.',
    );
  }

  if ((isApproved || isRejected) && !this.reviewedAt) {
    this.invalidate(
      'reviewedAt',
      'reviewedAt é obrigatório para verificações revisadas.',
    );
  }

  if ((isApproved || isRejected) && !this.reviewedBy) {
    this.invalidate(
      'reviewedBy',
      'reviewedBy é obrigatório para verificações revisadas.',
    );
  }

  if (isApproved && this.rejectionReason !== null) {
    this.invalidate(
      'rejectionReason',
      'Uma verificação aprovada não pode possuir motivo de rejeição.',
    );
  }

  if (isRejected && !this.rejectionReason) {
    this.invalidate(
      'rejectionReason',
      'rejectionReason é obrigatório para verificações rejeitadas.',
    );
  }

  next();
});

professionalProfileSchema.index({ userId: 1 }, { unique: true });
professionalProfileSchema.index({ verificationStatus: 1, submittedAt: 1 });

module.exports = mongoose.model('ProfessionalProfile', professionalProfileSchema);
