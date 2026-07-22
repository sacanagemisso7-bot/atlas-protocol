const mongoose = require('mongoose');

const TRACKING_RECORD_STATUSES = require('../constants/tracking-record-statuses');
const TRACKING_RECORD_TYPES = require('../constants/tracking-record-types');

function completedFieldMatchesStatus(value) {
  const hasValue = value !== null && value !== undefined;
  return this.status === TRACKING_RECORD_STATUSES.COMPLETED
    ? hasValue
    : !hasValue;
}

const trackingRecordSchema = new mongoose.Schema(
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
    protocolVersion: {
      type: Number,
      min: 1,
      default: null,
      validate: {
        validator(value) {
          return value === null || Number.isInteger(value);
        },
        message: 'protocolVersion deve ser um número inteiro.',
      },
    },
    protocolItemId: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(TRACKING_RECORD_TYPES),
      default: TRACKING_RECORD_TYPES.MANUAL,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    scheduledFor: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TRACKING_RECORD_STATUSES),
      default: TRACKING_RECORD_STATUSES.SCHEDULED,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
      validate: {
        validator: completedFieldMatchesStatus,
        message: 'completedAt deve ser informado apenas para registros concluídos.',
      },
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: completedFieldMatchesStatus,
        message: 'completedBy deve ser informado apenas para registros concluídos.',
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
  },
  {
    collection: 'tracking_records',
    timestamps: true,
  },
);

trackingRecordSchema.index({ athleteId: 1, scheduledFor: 1 });
trackingRecordSchema.index({ protocolId: 1, status: 1 });
trackingRecordSchema.index({ athleteId: 1, status: 1, scheduledFor: 1 });

module.exports = mongoose.model('TrackingRecord', trackingRecordSchema);
