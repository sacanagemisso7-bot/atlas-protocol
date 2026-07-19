const {
  cleanSubstanceName,
  normalizeSubstanceName,
} = require('../../src/utils/normalize-substance-name');

describe('normalização de nome de substância', () => {
  it('remove espaços externos e compacta espaços internos', () => {
    expect(cleanSubstanceName('  Creatina    Monohidratada  ')).toBe(
      'Creatina Monohidratada',
    );
  });

  it('normaliza caixa e caracteres Unicode compatíveis', () => {
    expect(normalizeSubstanceName(' ＣREATINA  ')).toBe('creatina');
  });
});
