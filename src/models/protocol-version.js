const mongoose = require('mongoose');

const PROTOCOL_FREQUENCY_TYPES = require('../constants/protocol-frequency-types');

const substanceSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
  },
  { _id: false },
);

const protocolItemSchema = new mongoose.Schema({
  substanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Substance',
    required: true,
  },
  substanceSnapshot: { type: substanceSnapshotSchema, required: true },
  instructions: { type: String, trim: true, maxlength: 1000, default: null },
  frequencyType: {
    type: String,
    enum: Object.values(PROTOCOL_FREQUENCY_TYPES),
    required: true,
  },
  weekDays: {
    type: [{ type: Number, min: 1, max: 7 }],
    default: [],
    validate: {
      validator(values) {
        return new Set(values).size === values.length;
      },
      message: 'weekDays não pode conter valores duplicados.',
    },
  },
  time: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  active: { type: Boolean, default: true },
  dosage: { type: String, trim: true, maxlength: 120, default: null },
  unit: { type: String, trim: true, maxlength: 40, default: null },
  frequency: { type: String, trim: true, maxlength: 120, default: null },
  schedule: { type: String, trim: true, maxlength: 200, default: null },
  notes: { type: String, trim: true, maxlength: 1000, default: null },
});

const protocolVersionSchema = new mongoose.Schema(
  {
    protocolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Protocol',
      required: true,
    },
    version: { type: Number, required: true, min: 1 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changeReason: { type: String, trim: true, maxlength: 500, default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    objective: { type: String, trim: true, maxlength: 1000, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    continuous: { type: Boolean, required: true },
    items: { type: [protocolItemSchema], default: [] },
  },
  {
    collection: 'protocol_versions',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

protocolVersionSchema.index({ protocolId: 1, version: 1 }, { unique: true });
protocolVersionSchema.index({ 'items.substanceId': 1 });

module.exports = mongoose.model('ProtocolVersion', protocolVersionSchema);
