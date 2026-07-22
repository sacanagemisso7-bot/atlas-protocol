const mongoose = require('mongoose');

const USER_ROLES = require('../constants/user-roles');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(USER_ROLES), required: true },
    active: { type: Boolean, default: true },
    blockedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
        delete returnedObject.passwordHash;
        return returnedObject;
      },
    },
  },
);

userSchema.index({ role: 1, active: 1 });

module.exports = mongoose.model('User', userSchema);
