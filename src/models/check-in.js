const mongoose = require('mongoose');

const CHECK_IN_STATUSES = require('../constants/check-in-statuses');
const { normalizeReferenceWeek } = require('../utils/normalize-reference-week');

const answersSchema = new mongoose.Schema(
  {
    weightKg: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          return value === null || value > 0;
        },
        message: 'weightKg deve ser maior que zero.',
      },
    },
    sleepHours: {
      type: Number,
      min: 0,
      max: 24,
      default: null,
    },
    energyScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    adherenceScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    reportedEffects: {
      type: [
        {
          type: String,
          trim: true,
          minlength: 1,
          maxlength: 500,
        },
      ],
      default: [],
      validate: {
        validator(values) {
          return values.length <= 20;
        },
        message: 'reportedEffects deve possuir no máximo 20 itens.',
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
  },
  { _id: false },
);

function submittedAtMatchesStatus(value) {
  const hasValue = value !== null && value !== undefined;
  return this.status === CHECK_IN_STATUSES.PENDING ? !hasValue : hasValue;
}

function reviewFieldMatchesStatus(value) {
  const hasValue = value !== null && value !== undefined;
  return this.status === CHECK_IN_STATUSES.REVIEWED ? hasValue : !hasValue;
}

const checkInSchema = new mongoose.Schema(
  {
    athleteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    professionalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    protocolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Protocol',
      default: null,
    },
    referenceWeek: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CHECK_IN_STATUSES),
      default: CHECK_IN_STATUSES.PENDING,
      required: true,
    },
    answers: {
      type: answersSchema,
      default: () => ({}),
    },
    submittedAt: {
      type: Date,
      default: null,
      validate: {
        validator: submittedAtMatchesStatus,
        message: 'submittedAt deve corresponder ao status do check-in.',
      },
    },
    reviewedAt: {
      type: Date,
      default: null,
      validate: {
        validator: reviewFieldMatchesStatus,
        message: 'reviewedAt deve ser informado apenas para check-ins revisados.',
      },
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: reviewFieldMatchesStatus,
        message: 'reviewedBy deve ser informado apenas para check-ins revisados.',
      },
    },
    reviewComment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
      validate: {
        validator: reviewFieldMatchesStatus,
        message:
          'reviewComment deve ser informado apenas para check-ins revisados.',
      },
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'check_ins',
    timestamps: true,
  },
);

checkInSchema.pre('validate', function normalizeWeek() {
  if (this.referenceWeek) {
    this.referenceWeek = normalizeReferenceWeek(this.referenceWeek);
  }
});

checkInSchema.index({ athleteId: 1, referenceWeek: 1 }, { unique: true });
checkInSchema.index({ professionalId: 1, status: 1, referenceWeek: -1 });
checkInSchema.index({ protocolId: 1, referenceWeek: -1 });

module.exports = mongoose.model('CheckIn', checkInSchema);
