const mongoose = require('mongoose');

const ProfessionalAthleteLink = require('../../src/models/professional-athlete-link');

describe('ProfessionalAthleteLink model', () => {
  it('define collection, campos e índices esperados', () => {
    expect(ProfessionalAthleteLink.collection.name).toBe(
      'professional_athlete_links',
    );
    expect(ProfessionalAthleteLink.schema.path('status').options.enum).toEqual(
      expect.arrayContaining(['pending', 'active', 'ended']),
    );

    const indexes = ProfessionalAthleteLink.schema.indexes();
    expect(indexes).toContainEqual([
      { professionalId: 1, athleteId: 1, status: 1 },
      expect.any(Object),
    ]);
    expect(indexes).toContainEqual([
      { athleteId: 1, status: 1 },
      expect.any(Object),
    ]);
    expect(indexes).toContainEqual([
      { professionalId: 1, athleteId: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { status: 'active' },
      }),
    ]);
  });

  it('exige endedAt quando o status é ended', async () => {
    const link = new ProfessionalAthleteLink({
      professionalId: new mongoose.Types.ObjectId(),
      athleteId: new mongoose.Types.ObjectId(),
      status: 'ended',
    });

    await expect(link.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ endedAt: expect.any(Object) }),
    });
  });
});
