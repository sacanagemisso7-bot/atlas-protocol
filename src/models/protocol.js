const mongoose = require('mongoose');

const PROTOCOL_STATUSES = require('../constants/protocol-statuses');

const protocolSchema = new mongoose.Schema(
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
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    objective: { type: String, trim: true, maxlength: 1000, default: null },
    status: {
      type: String,
      enum: Object.values(PROTOCOL_STATUSES),
      default: PROTOCOL_STATUSES.DRAFT,
      required: true,
    },
    currentVersion: { type: Number, required: true, min: 1, default: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    continuous: { type: Boolean, default: false },
    activatedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { collection: 'protocols', timestamps: true },
);

protocolSchema.index({ athleteId: 1, status: 1 });
protocolSchema.index({ professionalId: 1, status: 1 });
protocolSchema.index({ athleteId: 1, createdAt: -1 });

module.exports = mongoose.model('Protocol', protocolSchema);
