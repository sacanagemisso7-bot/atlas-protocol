const mongoose = require('mongoose');

const Substance = require('../../src/models/substance');

describe('Substance model', () => {
  it('normaliza internamente nome e normalizedName', async () => {
    const substance = new Substance({
      name: '  Creatina   Monohidratada  ',
      category: 'supplement',
      defaultUnit: 'g',
      createdBy: new mongoose.Types.ObjectId(),
    });

    await substance.validate();

    expect(substance.name).toBe('Creatina Monohidratada');
    expect(substance.normalizedName).toBe('creatina monohidratada');
  });

  it('define normalizedName como único e não selecionado por padrão', () => {
    const path = Substance.schema.path('normalizedName');

    expect(path.options.unique).toBe(true);
    expect(path.options.select).toBe(false);
    expect(Substance.schema.path('active').options.default).toBe(true);
  });
});
