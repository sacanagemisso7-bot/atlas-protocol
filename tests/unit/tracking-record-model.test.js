const mongoose = require('mongoose');

const TrackingRecord = require('../../src/models/tracking-record');

function createTrackingRecord(overrides = {}) {
  return new TrackingRecord({
    athleteId: new mongoose.Types.ObjectId(),
    professionalId: new mongoose.Types.ObjectId(),
    title: 'Registro de acompanhamento',
    scheduledFor: new Date('2026-08-05T11:00:00.000Z'),
    ...overrides,
  });
}

describe('TrackingRecord model', () => {
  it('define collection, estados, defaults e índices documentados', () => {
    const trackingRecord = createTrackingRecord();

    expect(TrackingRecord.collection.name).toBe('tracking_records');
    expect(trackingRecord.type).toBe('manual');
    expect(trackingRecord.status).toBe('scheduled');
    expect(TrackingRecord.schema.path('status').options.enum).toEqual(
      expect.arrayContaining(['scheduled', 'completed', 'missed', 'cancelled']),
    );
    expect(TrackingRecord.schema.path('type').options.enum).toEqual(
      expect.arrayContaining(['scheduled', 'manual']),
    );
    expect(TrackingRecord.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ athleteId: 1, scheduledFor: 1 }, expect.any(Object)],
        [{ protocolId: 1, status: 1 }, expect.any(Object)],
        [
          { athleteId: 1, status: 1, scheduledFor: 1 },
          expect.any(Object),
        ],
      ]),
    );
  });

  it('exige completedAt e completedBy para status completed', async () => {
    const invalid = createTrackingRecord({ status: 'completed' });
    const valid = createTrackingRecord({
      status: 'completed',
      completedAt: new Date('2026-08-05T11:10:00.000Z'),
      completedBy: new mongoose.Types.ObjectId(),
    });

    await expect(invalid.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        completedAt: expect.any(Object),
        completedBy: expect.any(Object),
      }),
    });
    await expect(valid.validate()).resolves.toBeUndefined();
  });

  it('rejeita dados de conclusão em estados não concluídos', async () => {
    const trackingRecord = createTrackingRecord({
      status: 'missed',
      completedAt: new Date('2026-08-05T11:10:00.000Z'),
      completedBy: new mongoose.Types.ObjectId(),
    });

    await expect(trackingRecord.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        completedAt: expect.any(Object),
        completedBy: expect.any(Object),
      }),
    });
  });

  it('valida título, data agendada e versão inteira positiva', async () => {
    const trackingRecord = createTrackingRecord({
      title: ' x ',
      scheduledFor: undefined,
      protocolVersion: 1.5,
    });

    await expect(trackingRecord.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        protocolVersion: expect.any(Object),
        scheduledFor: expect.any(Object),
        title: expect.any(Object),
      }),
    });
  });
});
