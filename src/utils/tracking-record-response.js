function toTrackingRecordResponse(trackingRecord) {
  return {
    id: trackingRecord.id,
    athleteId: trackingRecord.athleteId.toString(),
    professionalId: trackingRecord.professionalId.toString(),
    protocolId: trackingRecord.protocolId
      ? trackingRecord.protocolId.toString()
      : null,
    protocolVersion: trackingRecord.protocolVersion,
    protocolItemId: trackingRecord.protocolItemId,
    type: trackingRecord.type,
    title: trackingRecord.title,
    scheduledFor: trackingRecord.scheduledFor,
    status: trackingRecord.status,
    completedAt: trackingRecord.completedAt,
    completedBy: trackingRecord.completedBy
      ? trackingRecord.completedBy.toString()
      : null,
    notes: trackingRecord.notes,
    createdAt: trackingRecord.createdAt,
    updatedAt: trackingRecord.updatedAt,
  };
}

module.exports = { toTrackingRecordResponse };
