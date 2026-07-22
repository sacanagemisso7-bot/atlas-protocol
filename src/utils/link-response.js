function toLinkResponse(link) {
  return {
    id: link.id,
    professionalId: link.professionalId.toString(),
    athleteId: link.athleteId.toString(),
    status: link.status,
    invitedBy: link.invitedBy ? link.invitedBy.toString() : null,
    startedAt: link.startedAt,
    endedAt: link.endedAt,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

module.exports = toLinkResponse;
