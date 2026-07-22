const mongoose = require('mongoose');

const CheckIn = require('../../src/models/check-in');

function createCheckIn(overrides = {}) {
  return new CheckIn({
    athleteId: new mongoose.Types.ObjectId(),
    professionalId: new mongoose.Types.ObjectId(),
    referenceWeek: new Date('2026-08-05T12:00:00.000Z'),
    ...overrides,
  });
}

describe('CheckIn model', () => {
  it('define collection, estados, defaults e índices esperados', () => {
    const checkIn = createCheckIn();

    expect(CheckIn.collection.name).toBe('check_ins');
    expect(checkIn.status).toBe('pending');
    expect(checkIn.protocolId).toBeNull();
    expect(CheckIn.schema.path('status').options.enum).toEqual(
      expect.arrayContaining(['pending', 'submitted', 'reviewed']),
    );
    expect(CheckIn.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { athleteId: 1, referenceWeek: 1 },
          expect.objectContaining({ unique: true }),
        ],
        [
          { professionalId: 1, status: 1, referenceWeek: -1 },
          expect.any(Object),
        ],
        [{ protocolId: 1, referenceWeek: -1 }, expect.any(Object)],
      ]),
    );
  });

  it('normaliza referenceWeek antes da validação', async () => {
    const checkIn = createCheckIn();

    await checkIn.validate();

    expect(checkIn.referenceWeek.toISOString()).toBe(
      '2026-08-03T03:00:00.000Z',
    );
  });

  it('valida limites das respostas e quantidade de efeitos relatados', async () => {
    const checkIn = createCheckIn({
      answers: {
        weightKg: 0,
        sleepHours: 25,
        energyScore: 11,
        adherenceScore: -1,
        reportedEffects: Array.from({ length: 21 }, (_, index) => `Efeito ${index}`),
      },
    });

    await expect(checkIn.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        'answers.adherenceScore': expect.any(Object),
        'answers.energyScore': expect.any(Object),
        'answers.reportedEffects': expect.any(Object),
        'answers.sleepHours': expect.any(Object),
        'answers.weightKg': expect.any(Object),
      }),
    });
  });

  it('exige submittedAt a partir do envio e campos de revisão em reviewed', async () => {
    const submittedWithoutDate = createCheckIn({ status: 'submitted' });
    const reviewedWithoutFields = createCheckIn({
      status: 'reviewed',
      submittedAt: new Date(),
    });
    const validReviewed = createCheckIn({
      status: 'reviewed',
      submittedAt: new Date('2026-08-05T12:00:00.000Z'),
      reviewedAt: new Date('2026-08-05T13:00:00.000Z'),
      reviewedBy: new mongoose.Types.ObjectId(),
      reviewComment: 'Revisão registrada.',
    });

    await expect(submittedWithoutDate.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ submittedAt: expect.any(Object) }),
    });
    await expect(reviewedWithoutFields.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        reviewComment: expect.any(Object),
        reviewedAt: expect.any(Object),
        reviewedBy: expect.any(Object),
      }),
    });
    await expect(validReviewed.validate()).resolves.toBeUndefined();
  });

  it('rejeita timestamps de envio ou revisão incompatíveis com pending', async () => {
    const checkIn = createCheckIn({
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: new mongoose.Types.ObjectId(),
      reviewComment: 'Comentário indevido.',
    });

    await expect(checkIn.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        reviewComment: expect.any(Object),
        reviewedAt: expect.any(Object),
        reviewedBy: expect.any(Object),
        submittedAt: expect.any(Object),
      }),
    });
  });
});
