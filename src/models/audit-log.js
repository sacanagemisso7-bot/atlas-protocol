const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      immutable: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      immutable: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      immutable: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
      immutable: true,
    },
    ipHash: {
      type: String,
      trim: true,
      maxlength: 128,
      default: null,
      immutable: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    collection: 'audit_logs',
    strict: 'throw',
    versionKey: false,
    toJSON: {
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        return returnedObject;
      },
    },
  },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
