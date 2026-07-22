function cleanSubstanceName(name) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizeSubstanceName(name) {
  return cleanSubstanceName(name).toLocaleLowerCase('pt-BR');
}

module.exports = { cleanSubstanceName, normalizeSubstanceName };
