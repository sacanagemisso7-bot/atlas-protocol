const mongoose = require('mongoose');

const LINK_STATUSES = require('../constants/link-statuses');

const professionalAthleteLinkSchema = new mongoose.Schema(
  {
    professionalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    athleteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(LINK_STATUSES),
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return this.status !== LINK_STATUSES.ENDED || value !== null;
        },
        message: 'endedAt é obrigatório para vínculos encerrados.',
      },
    },
  },
  {
    collection: 'professional_athlete_links',
    timestamps: true,
  },
);

professionalAthleteLinkSchema.index({
  professionalId: 1,
  athleteId: 1,
  status: 1,
});
professionalAthleteLinkSchema.index({ athleteId: 1, status: 1 });
professionalAthleteLinkSchema.index(
  { professionalId: 1, athleteId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: LINK_STATUSES.ACTIVE },
  },
);

module.exports = mongoose.model(
  'ProfessionalAthleteLink',
  professionalAthleteLinkSchema,
);
