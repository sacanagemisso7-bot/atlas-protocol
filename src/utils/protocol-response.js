function toProtocolResponse(
  protocol,
  { includeStatusHistory = true } = {},
) {
  const response = {
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

  if (includeStatusHistory) {
    response.statusHistory = protocol.statusHistory.map((entry) => ({
      from: entry.from,
      to: entry.to,
      reason: entry.reason,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy.toString(),
    }));
  }

  return response;
}

function toVersionResponse(version) {
  return {
    id: version.id,
    protocolId: version.protocolId.toString(),
    version: version.version,
    createdBy: version.createdBy.toString(),
    changeReason: version.changeReason,
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
    })),
    createdAt: version.createdAt,
  };
}

module.exports = { toProtocolResponse, toVersionResponse };
