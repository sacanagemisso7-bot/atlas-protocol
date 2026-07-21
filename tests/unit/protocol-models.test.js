const mongoose = require('mongoose');

const Protocol = require('../../src/models/protocol');
const ProtocolVersion = require('../../src/models/protocol-version');

describe('models de protocolo', () => {
  it('define estados, versão inicial e índices do Protocol', () => {
    expect(Protocol.schema.path('status').options.enum).toEqual(
      expect.arrayContaining(['draft', 'active', 'paused', 'closed', 'cancelled']),
    );
    expect(Protocol.schema.path('currentVersion').options.default).toBe(1);
    expect(Protocol.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ athleteId: 1, status: 1 }, expect.any(Object)],
        [{ professionalId: 1, status: 1 }, expect.any(Object)],
      ]),
    );
  });

  it('define unicidade sequencial e snapshot obrigatório na versão', async () => {
    expect(ProtocolVersion.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { protocolId: 1, version: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );

    const version = new ProtocolVersion({
      protocolId: new mongoose.Types.ObjectId(),
      version: 1,
      createdBy: new mongoose.Types.ObjectId(),
      title: 'Protocolo teste',
      startDate: new Date(),
      continuous: true,
      items: [
        {
          substanceId: new mongoose.Types.ObjectId(),
          frequencyType: 'daily',
        },
      ],
    });

    await expect(version.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        'items.0.substanceSnapshot': expect.any(Object),
      }),
    });
  });
});
