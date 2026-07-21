function toProtocolResponse(protocol) {
  return {
    id: protocol.id,
    athleteId: protocol.athleteId.toString(),
    professionalId: protocol.professionalId.toString(),
    title: protocol.title,
    objective: protocol.objective,
    status: protocol.status,
    currentVersion: protocol.currentVersion,
    startDate: protocol.startDate,
    endDate: protocol.endDate,
    continuous: protocol.continuous,
    activatedAt: protocol.activatedAt,
    pausedAt: protocol.pausedAt,
    closedAt: protocol.closedAt,
    cancelledAt: protocol.cancelledAt,
    createdAt: protocol.createdAt,
    updatedAt: protocol.updatedAt,
  };
}

function toVersionResponse(version) {
  return {
    id: version.id,
    protocolId: version.protocolId.toString(),
    version: version.version,
    createdBy: version.createdBy.toString(),
    changeReason: version.changeReason,
    title: version.title,
    objective: version.objective,
    startDate: version.startDate,
    endDate: version.endDate,
    continuous: version.continuous,
    items: version.items.map((item) => ({
      id: item.id,
      substanceId: item.substanceId.toString(),
      substanceSnapshot: item.substanceSnapshot.toObject(),
      instructions: item.instructions,
      frequencyType: item.frequencyType,
      weekDays: item.weekDays,
      time: item.time,
      startDate: item.startDate,
      endDate: item.endDate,
      active: item.active,
      dosage: item.dosage,
      unit: item.unit,
      frequency: item.frequency,
      schedule: item.schedule,
      notes: item.notes,
    })),
    createdAt: version.createdAt,
  };
}

module.exports = { toProtocolResponse, toVersionResponse };
