function toCheckInResponse(checkIn) {
  return {
    id: checkIn.id,
    athleteId: checkIn.athleteId.toString(),
    professionalId: checkIn.professionalId.toString(),
    protocolId: checkIn.protocolId ? checkIn.protocolId.toString() : null,
    referenceWeek: checkIn.referenceWeek,
    status: checkIn.status,
    answers: {
      weightKg: checkIn.answers.weightKg,
      sleepHours: checkIn.answers.sleepHours,
      energyScore: checkIn.answers.energyScore,
      adherenceScore: checkIn.answers.adherenceScore,
      reportedEffects: [...checkIn.answers.reportedEffects],
      notes: checkIn.answers.notes,
    },
    submittedAt: checkIn.submittedAt,
    reviewedAt: checkIn.reviewedAt,
    reviewedBy: checkIn.reviewedBy ? checkIn.reviewedBy.toString() : null,
    reviewComment: checkIn.reviewComment,
    reopenedAt: checkIn.reopenedAt,
    createdAt: checkIn.createdAt,
    updatedAt: checkIn.updatedAt,
  };
}

module.exports = { toCheckInResponse };
