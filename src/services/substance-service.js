const ERROR_CODES = require('../constants/error-codes');
const Substance = require('../models/substance');
const AppError = require('../utils/app-error');
const {
  cleanSubstanceName,
  normalizeSubstanceName,
} = require('../utils/normalize-substance-name');
const toSubstanceResponse = require('../utils/substance-response');

function notFoundError() {
  return new AppError(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    'Substância não encontrada.',
  );
}

function duplicateError() {
  return new AppError(
    409,
    ERROR_CODES.DUPLICATE_RESOURCE,
    'Já existe uma substância com este nome.',
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureUniqueName(normalizedName, excludedId = null) {
  const filter = { normalizedName };
  if (excludedId) filter._id = { $ne: excludedId };

  if (await Substance.exists(filter)) throw duplicateError();
}

async function createSubstance(requester, input) {
  const name = cleanSubstanceName(input.name);
  const normalizedName = normalizeSubstanceName(name);
  await ensureUniqueName(normalizedName);

  try {
    const substance = await Substance.create({
      ...input,
      name,
      normalizedName,
      description: input.description || null,
      createdBy: requester.id,
    });
    return toSubstanceResponse(substance);
  } catch (error) {
    if (error.code === 11000) throw duplicateError();
    throw error;
  }
}

async function listSubstances(query) {
  const { page, limit, search, category, active, sortBy, sortOrder } = query;
  const filters = {};

  if (category) filters.category = category;
  if (active !== undefined) filters.active = active;
  if (search) {
    const expression = new RegExp(escapeRegExp(search), 'i');
    filters.$or = [{ name: expression }, { description: expression }];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const [substances, total] = await Promise.all([
    Substance.find(filters).sort(sort).skip(skip).limit(limit),
    Substance.countDocuments(filters),
  ]);

  return {
    substances: substances.map(toSubstanceResponse),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getSubstanceById(substanceId) {
  const substance = await Substance.findById(substanceId);
  if (!substance) throw notFoundError();
  return toSubstanceResponse(substance);
}

async function updateSubstance(substanceId, input) {
  const substance = await Substance.findById(substanceId).select(
    '+normalizedName',
  );
  if (!substance) throw notFoundError();

  if (input.name !== undefined) {
    const name = cleanSubstanceName(input.name);
    const normalizedName = normalizeSubstanceName(name);
    await ensureUniqueName(normalizedName, substance.id);
    substance.name = name;
    substance.normalizedName = normalizedName;
  }
  if (input.description !== undefined) {
    substance.description = input.description || null;
  }
  if (input.category !== undefined) substance.category = input.category;
  if (input.defaultUnit !== undefined) {
    substance.defaultUnit = input.defaultUnit;
  }

  try {
    await substance.save();
  } catch (error) {
    if (error.code === 11000) throw duplicateError();
    throw error;
  }

  return toSubstanceResponse(substance);
}

async function updateSubstanceStatus(substanceId, active) {
  const substance = await Substance.findById(substanceId);
  if (!substance) throw notFoundError();

  substance.active = active;
  await substance.save();

  return toSubstanceResponse(substance);
}

module.exports = {
  createSubstance,
  getSubstanceById,
  listSubstances,
  updateSubstance,
  updateSubstanceStatus,
};
