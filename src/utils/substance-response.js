function toSubstanceResponse(substance) {
  return {
    id: substance.id,
    name: substance.name,
    description: substance.description,
    category: substance.category,
    defaultUnit: substance.defaultUnit,
    active: substance.active,
    createdBy: substance.createdBy.toString(),
    createdAt: substance.createdAt,
    updatedAt: substance.updatedAt,
  };
}

module.exports = toSubstanceResponse;
