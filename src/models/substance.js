const mongoose = require('mongoose');

const SUBSTANCE_CATEGORIES = require('../constants/substance-categories');
const SUBSTANCE_UNITS = require('../constants/substance-units');
const {
  cleanSubstanceName,
  normalizeSubstanceName,
} = require('../utils/normalize-substance-name');

const substanceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 120,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    category: {
      type: String,
      enum: Object.values(SUBSTANCE_CATEGORIES),
      required: true,
    },
    defaultUnit: {
      type: String,
      enum: Object.values(SUBSTANCE_UNITS),
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    collection: 'substances',
    timestamps: true,
  },
);

substanceSchema.index({ category: 1, active: 1 });
substanceSchema.index({ name: 1 });

substanceSchema.pre('validate', function normalizeName() {
  if (this.name) {
    this.name = cleanSubstanceName(this.name);
    this.normalizedName = normalizeSubstanceName(this.name);
  }
});

module.exports = mongoose.model('Substance', substanceSchema);
