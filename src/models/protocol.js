const mongoose = require('mongoose');

const PROTOCOL_STATUS_TRANSITIONS = require('../constants/protocol-status-transitions');
const PROTOCOL_STATUSES = require('../constants/protocol-statuses');

const STATUS_HISTORY_APPEND_ONLY_ERROR =
  'statusHistory é append-only e só pode receber novas entradas.';

const protocolStatusHistorySchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: [null, ...Object.values(PROTOCOL_STATUSES)],
      default: null,
      immutable: true,
    },
    to: {
      type: String,
      enum: Object.values(PROTOCOL_STATUSES),
      required: true,
      immutable: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
      immutable: true,
    },
    changedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  { _id: false },
);

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
    statusHistory: {
      type: [protocolStatusHistorySchema],
      required: true,
      validate: {
        validator(entries) {
          return entries.length > 0;
        },
        message: 'statusHistory deve possuir ao menos a entrada inicial.',
      },
    },
  },
  { collection: 'protocols', timestamps: true },
);

protocolSchema.pre('validate', function validateStatusHistory(next) {
  const history = this.statusHistory || [];
  const firstEntry = history[0];

  if (
    firstEntry &&
    (firstEntry.from !== null ||
      firstEntry.to !== PROTOCOL_STATUSES.DRAFT ||
      firstEntry.reason !== null ||
      !firstEntry.changedBy ||
      !this.professionalId ||
      firstEntry.changedBy.toString() !== this.professionalId.toString())
  ) {
    this.invalidate(
      'statusHistory',
      'statusHistory deve começar com a entrada inicial oficial null -> draft.',
    );
  }

  for (let index = 1; index < history.length; index += 1) {
    const previousEntry = history[index - 1];
    const currentEntry = history[index];
    const allowedTargets = PROTOCOL_STATUS_TRANSITIONS[previousEntry.to] || [];

    if (
      currentEntry.from !== previousEntry.to ||
      !allowedTargets.includes(currentEntry.to)
    ) {
      this.invalidate(
        'statusHistory',
        'statusHistory contém uma transição de estado inválida.',
      );
      break;
    }

    if (currentEntry.changedAt < previousEntry.changedAt) {
      this.invalidate(
        'statusHistory',
        'statusHistory deve respeitar a ordem cronológica das transições.',
      );
      break;
    }
  }

  const lastEntry = history.at(-1);
  if (lastEntry && lastEntry.to !== this.status) {
    this.invalidate(
      'statusHistory',
      'O status atual deve corresponder à última entrada de statusHistory.',
    );
  }

  next();
});

protocolSchema.pre('save', function preventStatusHistoryReplacement(next) {
  if (!this.isNew && this.isModified('statusHistory')) {
    return next(new Error(STATUS_HISTORY_APPEND_ONLY_ERROR));
  }
  return next();
});

protocolSchema.query.allowAtomicStatusTransition =
  function allowAtomicStatusTransition() {
    this.atomicStatusTransitionAllowed = true;
    return this;
  };

protocolSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  function preventStatusHistoryMutation(next) {
    const update = this.getUpdate() || {};
    if (Array.isArray(update)) {
      return next(new Error(STATUS_HISTORY_APPEND_ONLY_ERROR));
    }

    const historyMutations = [];
    const statusMutations = [];

    for (const [operator, values] of Object.entries(update)) {
      if (operator.startsWith('$')) {
        for (const path of Object.keys(values || {})) {
          if (path === 'statusHistory' || path.startsWith('statusHistory.')) {
            historyMutations.push({ operator, path });
          } else if (path === 'status' || path.startsWith('status.')) {
            statusMutations.push({ operator, path });
          }
        }
      } else if (
        operator === 'statusHistory' ||
        operator.startsWith('statusHistory.')
      ) {
        historyMutations.push({ operator: '$set', path: operator });
      } else if (operator === 'status' || operator.startsWith('status.')) {
        statusMutations.push({ operator: '$set', path: operator });
      }
    }

    const historyEntry = update.$push?.statusHistory;
    const nextStatus = update.$set?.status;
    const isAuthorizedTransition =
      this.atomicStatusTransitionAllowed === true &&
      historyMutations.length === 1 &&
      historyMutations[0].operator === '$push' &&
      historyMutations[0].path === 'statusHistory' &&
      statusMutations.length === 1 &&
      statusMutations[0].operator === '$set' &&
      statusMutations[0].path === 'status' &&
      historyEntry &&
      !historyEntry.$each &&
      historyEntry.to === nextStatus;

    if (
      (historyMutations.length || statusMutations.length) &&
      !isAuthorizedTransition
    ) {
      return next(new Error(STATUS_HISTORY_APPEND_ONLY_ERROR));
    }
    return next();
  },
);

protocolSchema.pre(
  ['findOneAndReplace', 'replaceOne'],
  function preventProtocolReplacement(next) {
    return next(new Error(STATUS_HISTORY_APPEND_ONLY_ERROR));
  },
);

protocolSchema.index({ athleteId: 1, status: 1 });
protocolSchema.index({ professionalId: 1, status: 1 });
protocolSchema.index({ athleteId: 1, createdAt: -1 });

module.exports = mongoose.model('Protocol', protocolSchema);
