const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const ProfessionalAthleteLink = require('../../src/models/professional-athlete-link');
const Protocol = require('../../src/models/protocol');
const TrackingRecord = require('../../src/models/tracking-record');
const User = require('../../src/models/user');
const { generateToken } = require('../../src/utils/jwt');

let passwordHash;

async function createUser(role, overrides = {}) {
  return User.create({
    name: `Usuário ${role}`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash,
    role,
    ...overrides,
  });
}

async function createLink(professional, athlete, overrides = {}) {
  return ProfessionalAthleteLink.create({
    professionalId: professional.id,
    athleteId: athlete.id,
    status: 'active',
    startedAt: new Date('2026-07-01T12:00:00.000Z'),
    ...overrides,
  });
}

async function createProtocol(professional, athlete, overrides = {}) {
  return Protocol.create({
    athleteId: athlete.id,
    professionalId: professional.id,
    title: `Protocolo ${new mongoose.Types.ObjectId()}`,
    status: 'active',
    currentVersion: 3,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    continuous: true,
    activatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  });
}

async function createTrackingRecord(professional, athlete, overrides = {}) {
  const status = overrides.status || 'scheduled';
  return TrackingRecord.create({
    athleteId: athlete.id,
    professionalId: professional.id,
    protocolId: null,
    protocolVersion: null,
    protocolItemId: null,
    type: 'manual',
    title: `Registro ${new mongoose.Types.ObjectId()}`,
    scheduledFor: new Date('2026-08-05T11:00:00.000Z'),
    status,
    completedAt:
      status === 'completed'
        ? new Date('2026-08-05T11:10:00.000Z')
        : null,
    completedBy: status === 'completed' ? athlete.id : null,
    notes: 'Informação registrada sem interpretação clínica.',
    ...overrides,
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

function trackingPayload(athlete, overrides = {}) {
  return {
    athleteId: athlete.id,
    title: 'Registro manual de acompanhamento',
    scheduledFor: '2026-08-05T11:00:00.000Z',
    notes: 'Relato armazenado sem interpretação clínica.',
    ...overrides,
  };
}

describe('registros de acompanhamento', () => {
  let mongoServer;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('SenhaForte123!', 10);
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([
      ProfessionalAthleteLink.init(),
      TrackingRecord.init(),
    ]);
  }, 120000);

  afterEach(async () => {
    await Promise.all([
      TrackingRecord.deleteMany({}),
      Protocol.deleteMany({}),
      ProfessionalAthleteLink.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/tracking-records', () => {
    it('permite que professional vinculado crie registro e deriva IDs internos', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const protocol = await createProtocol(professional, athlete);
      await createLink(professional, athlete);

      const response = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send(
          trackingPayload(athlete, {
            protocolId: protocol.id,
          }),
        );

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          trackingRecord: {
            athleteId: athlete.id,
            professionalId: professional.id,
            protocolId: protocol.id,
            protocolVersion: 3,
            type: 'manual',
            status: 'scheduled',
            completedAt: null,
            completedBy: null,
          },
        },
      });

      const stored = await TrackingRecord.findById(
        response.body.data.trackingRecord.id,
      );
      expect(stored).toMatchObject({
        professionalId: professional._id,
        athleteId: athlete._id,
        protocolId: protocol._id,
        protocolVersion: 3,
      });
    });

    it('permite que athlete crie registro próprio e infere o vínculo único', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const response = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(athlete))
        .send(trackingPayload(athlete));

      expect(response.status).toBe(201);
      expect(response.body.data.trackingRecord).toMatchObject({
        athleteId: athlete.id,
        professionalId: professional.id,
        protocolId: null,
        protocolVersion: null,
        type: 'manual',
        status: 'scheduled',
      });
    });

    it('infere para o athlete o professional e a versão do protocolo ativo', async () => {
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      await createLink(otherProfessional, athlete);
      const protocol = await createProtocol(professional, athlete, {
        currentVersion: 7,
      });

      const response = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(athlete))
        .send(trackingPayload(athlete, { protocolId: protocol.id }));

      expect(response.status).toBe(201);
      expect(response.body.data.trackingRecord).toMatchObject({
        professionalId: professional.id,
        protocolId: protocol.id,
        protocolVersion: 7,
      });
    });

    it('exige autenticação e impede criação por admin', async () => {
      const admin = await createUser('admin');
      const athlete = await createUser('athlete');

      const unauthenticated = await request(app)
        .post('/api/v1/tracking-records')
        .send(trackingPayload(athlete));
      const forbidden = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(admin))
        .send(trackingPayload(athlete));

      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body.error.code).toBe('AUTH_REQUIRED');
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
    });

    it('impede professional sem vínculo ativo e athlete sem vínculo ativo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete, {
        status: 'ended',
        endedAt: new Date('2026-07-10T00:00:00.000Z'),
      });

      const professionalResponse = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send(trackingPayload(athlete));
      const athleteResponse = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(athlete))
        .send(trackingPayload(athlete));

      expect(professionalResponse.status).toBe(403);
      expect(professionalResponse.body.error.code).toBe('FORBIDDEN');
      expect(athleteResponse.status).toBe(403);
      expect(athleteResponse.body.error.code).toBe('FORBIDDEN');
      expect(await TrackingRecord.countDocuments()).toBe(0);
    });

    it('rejeita inferência ambígua quando athlete possui mais de um vínculo ativo', async () => {
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      await createLink(otherProfessional, athlete);

      const response = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(athlete))
        .send(trackingPayload(athlete));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await TrackingRecord.countDocuments()).toBe(0);
    });

    it('impede athlete de criar para outro usuário', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createLink(professional, athlete);

      const response = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(athlete))
        .send(trackingPayload(otherAthlete));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(await TrackingRecord.countDocuments()).toBe(0);
    });

    it('valida athlete existente, perfil e ObjectIds', async () => {
      const professional = await createUser('professional');
      const wrongRole = await createUser('professional');

      const missing = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send(
          trackingPayload({ id: new mongoose.Types.ObjectId().toString() }),
        );
      const incompatible = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send(trackingPayload(wrongRole));
      const invalid = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send(trackingPayload({ id: 'id-invalido' }));

      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(incompatible.status).toBe(400);
      expect(incompatible.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
    });

    it('valida existência, atleta, status e ownership do protocolo', async () => {
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createLink(professional, athlete);
      const otherAthleteProtocol = await createProtocol(
        professional,
        otherAthlete,
      );
      const otherProfessionalProtocol = await createProtocol(
        otherProfessional,
        athlete,
      );
      const inactiveProtocol = await createProtocol(professional, athlete, {
        status: 'closed',
        closedAt: new Date('2026-07-20T00:00:00.000Z'),
      });

      const cases = [
        {
          protocolId: new mongoose.Types.ObjectId().toString(),
          expectedStatus: 404,
          expectedCode: 'RESOURCE_NOT_FOUND',
        },
        {
          protocolId: otherAthleteProtocol.id,
          expectedStatus: 400,
          expectedCode: 'VALIDATION_ERROR',
        },
        {
          protocolId: otherProfessionalProtocol.id,
          expectedStatus: 404,
          expectedCode: 'RESOURCE_NOT_FOUND',
        },
        {
          protocolId: inactiveProtocol.id,
          expectedStatus: 422,
          expectedCode: 'INVALID_STATE_TRANSITION',
        },
      ];

      for (const currentCase of cases) {
        const response = await request(app)
          .post('/api/v1/tracking-records')
          .set('Authorization', authorization(professional))
          .send(
            trackingPayload(athlete, {
              protocolId: currentCase.protocolId,
            }),
          );

        expect(response.status).toBe(currentCase.expectedStatus);
        expect(response.body.error.code).toBe(currentCase.expectedCode);
      }
      expect(await TrackingRecord.countDocuments()).toBe(0);
    });

    it('rejeita campos internos, desconhecidos e payload inválido', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const injected = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send({
          ...trackingPayload(athlete),
          professionalId: new mongoose.Types.ObjectId().toString(),
          type: 'scheduled',
          protocolVersion: 99,
          status: 'completed',
          completedBy: professional.id,
          createdBy: professional.id,
          measurements: { diagnosis: 'não deve ser aceito' },
        });
      const invalid = await request(app)
        .post('/api/v1/tracking-records')
        .set('Authorization', authorization(professional))
        .send(
          trackingPayload(athlete, {
            title: 'x',
            scheduledFor: 'data-inválida',
          }),
        );

      expect(injected.status).toBe(400);
      expect(injected.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      expect(await TrackingRecord.countDocuments()).toBe(0);
    });
  });

  describe('GET /api/v1/tracking-records', () => {
    it('permite que admin filtre, ordene e pagine todos os registros', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      const protocol = await createProtocol(professional, athlete);
      await createTrackingRecord(professional, athlete, {
        protocolId: protocol.id,
        protocolVersion: protocol.currentVersion,
        status: 'completed',
        scheduledFor: new Date('2026-08-05T10:00:00.000Z'),
      });
      await createTrackingRecord(professional, athlete, {
        scheduledFor: new Date('2026-08-06T10:00:00.000Z'),
      });
      await createTrackingRecord(otherProfessional, otherAthlete, {
        scheduledFor: new Date('2026-08-07T10:00:00.000Z'),
      });

      const filtered = await request(app)
        .get(
          `/api/v1/tracking-records?athleteId=${athlete.id}&professionalId=${professional.id}&protocolId=${protocol.id}&status=completed&dateFrom=2026-08-05T00:00:00.000Z&dateTo=2026-08-05T23:59:59.999Z&sortBy=scheduledFor&sortOrder=asc`,
        )
        .set('Authorization', authorization(admin));
      const paginated = await request(app)
        .get(
          '/api/v1/tracking-records?page=2&limit=1&sortBy=scheduledFor&sortOrder=asc',
        )
        .set('Authorization', authorization(admin));

      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0]).toMatchObject({
        athleteId: athlete.id,
        professionalId: professional.id,
        protocolId: protocol.id,
        status: 'completed',
      });
      expect(paginated.status).toBe(200);
      expect(paginated.body.data).toHaveLength(1);
      expect(paginated.body.data[0].scheduledFor).toBe(
        '2026-08-06T10:00:00.000Z',
      );
      expect(paginated.body.meta).toEqual({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
    });

    it('restringe professional aos atletas atualmente vinculados', async () => {
      const professional = await createUser('professional');
      const recordAuthor = await createUser('professional');
      const linkedAthlete = await createUser('athlete');
      const endedAthlete = await createUser('athlete');
      await createLink(professional, linkedAthlete);
      await createLink(professional, endedAthlete, {
        status: 'ended',
        endedAt: new Date('2026-07-10T00:00:00.000Z'),
      });
      await createTrackingRecord(recordAuthor, linkedAthlete);
      await createTrackingRecord(recordAuthor, endedAthlete);

      const normal = await request(app)
        .get('/api/v1/tracking-records')
        .set('Authorization', authorization(professional));
      const attemptedExpansion = await request(app)
        .get(`/api/v1/tracking-records?athleteId=${endedAthlete.id}`)
        .set('Authorization', authorization(professional));

      expect(normal.status).toBe(200);
      expect(normal.body.data).toHaveLength(1);
      expect(normal.body.data[0].athleteId).toBe(linkedAthlete.id);
      expect(attemptedExpansion.body.data).toHaveLength(1);
      expect(attemptedExpansion.body.data[0].athleteId).toBe(linkedAthlete.id);
    });

    it('restringe athlete aos próprios registros mesmo com filtro externo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createTrackingRecord(professional, athlete);
      await createTrackingRecord(professional, otherAthlete);

      const response = await request(app)
        .get(`/api/v1/tracking-records?athleteId=${otherAthlete.id}`)
        .set('Authorization', authorization(athlete));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].athleteId).toBe(athlete.id);
    });

    it('exige autenticação e rejeita query inválida', async () => {
      const admin = await createUser('admin');
      const unauthenticated = await request(app).get(
        '/api/v1/tracking-records',
      );
      const invalid = await request(app)
        .get(
          '/api/v1/tracking-records?limit=101&status=invalid&sortBy=title&extra=true',
        )
        .set('Authorization', authorization(admin));

      expect(unauthenticated.status).toBe(401);
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/tracking-records/:id', () => {
    it('permite consulta por admin, professional vinculado e próprio athlete', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const recordAuthor = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(recordAuthor, athlete);

      for (const requester of [admin, professional, athlete]) {
        const response = await request(app)
          .get(`/api/v1/tracking-records/${trackingRecord.id}`)
          .set('Authorization', authorization(requester));

        expect(response.status).toBe(200);
        expect(response.body.data.trackingRecord.id).toBe(trackingRecord.id);
      }
    });

    it('oculta de usuário externo e de professional cujo vínculo terminou', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('athlete');
      const link = await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(professional, athlete);
      link.status = 'ended';
      link.endedAt = new Date();
      await link.save();

      for (const requester of [professional, outsider]) {
        const response = await request(app)
          .get(`/api/v1/tracking-records/${trackingRecord.id}`)
          .set('Authorization', authorization(requester));

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      }
    });

    it('retorna erros padronizados para recurso inexistente e ID inválido', async () => {
      const admin = await createUser('admin');
      const missing = await request(app)
        .get(`/api/v1/tracking-records/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', authorization(admin));
      const invalid = await request(app)
        .get('/api/v1/tracking-records/id-invalido')
        .set('Authorization', authorization(admin));

      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
    });
  });

  describe('PATCH /api/v1/tracking-records/:id', () => {
    it('permite que professional vinculado altere registro scheduled', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(professional, athlete);

      const response = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}`)
        .set('Authorization', authorization(professional))
        .send({
          title: 'Registro reagendado',
          scheduledFor: '2026-08-08T12:00:00.000Z',
          notes: 'Apenas organização do registro.',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.trackingRecord).toMatchObject({
        title: 'Registro reagendado',
        scheduledFor: '2026-08-08T12:00:00.000Z',
        notes: 'Apenas organização do registro.',
        status: 'scheduled',
      });
    });

    it('impede admin, athlete, professional externo e vínculo encerrado', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const outsider = await createUser('professional');
      const athlete = await createUser('athlete');
      const link = await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(professional, athlete);

      for (const requester of [admin, athlete]) {
        const response = await request(app)
          .patch(`/api/v1/tracking-records/${trackingRecord.id}`)
          .set('Authorization', authorization(requester))
          .send({ notes: 'Tentativa sem permissão.' });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }

      const outsiderResponse = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}`)
        .set('Authorization', authorization(outsider))
        .send({ notes: 'Tentativa externa.' });
      expect(outsiderResponse.status).toBe(404);

      link.status = 'ended';
      link.endedAt = new Date();
      await link.save();
      const endedResponse = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}`)
        .set('Authorization', authorization(professional))
        .send({ notes: 'Tentativa após encerramento.' });
      expect(endedResponse.status).toBe(404);

      const unchanged = await TrackingRecord.findById(trackingRecord.id);
      expect(unchanged.notes).toBe(
        'Informação registrada sem interpretação clínica.',
      );
    });

    it('rejeita alteração de registro final, payload inválido e campos internos', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const completed = await createTrackingRecord(professional, athlete, {
        status: 'completed',
      });
      const scheduled = await createTrackingRecord(professional, athlete);

      const readOnly = await request(app)
        .patch(`/api/v1/tracking-records/${completed.id}`)
        .set('Authorization', authorization(professional))
        .send({ notes: 'Não deve mudar.' });
      const empty = await request(app)
        .patch(`/api/v1/tracking-records/${scheduled.id}`)
        .set('Authorization', authorization(professional))
        .send({});
      const injected = await request(app)
        .patch(`/api/v1/tracking-records/${scheduled.id}`)
        .set('Authorization', authorization(professional))
        .send({ professionalId: professional.id, status: 'completed' });

      expect(readOnly.status).toBe(422);
      expect(readOnly.body.error.code).toBe('INVALID_STATE_TRANSITION');
      expect(empty.status).toBe(400);
      expect(empty.body.error.code).toBe('VALIDATION_ERROR');
      expect(injected.status).toBe(400);
      expect(injected.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('valida ID e recurso inexistente', async () => {
      const professional = await createUser('professional');
      const invalid = await request(app)
        .patch('/api/v1/tracking-records/id-invalido')
        .set('Authorization', authorization(professional))
        .send({ notes: 'Atualização.' });
      const missing = await request(app)
        .patch(`/api/v1/tracking-records/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', authorization(professional))
        .send({ notes: 'Atualização.' });

      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/tracking-records/:id/status', () => {
    it('permite que professional conclua e respeita completedAt informado', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(professional, athlete);

      const response = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(professional))
        .send({
          status: 'completed',
          completedAt: '2026-08-05T11:15:00.000Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.trackingRecord).toMatchObject({
        status: 'completed',
        completedAt: '2026-08-05T11:15:00.000Z',
        completedBy: professional.id,
      });
    });

    it('permite que athlete conclua registro próprio e gera completedAt', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const trackingRecord = await createTrackingRecord(professional, athlete);
      const before = Date.now();

      const response = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(athlete))
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.data.trackingRecord.status).toBe('completed');
      expect(response.body.data.trackingRecord.completedBy).toBe(athlete.id);
      expect(new Date(response.body.data.trackingRecord.completedAt).getTime()).toBeGreaterThanOrEqual(before);
    });

    it.each(['missed', 'cancelled'])(
      'permite transição scheduled -> %s sem apagar histórico',
      async (status) => {
        const professional = await createUser('professional');
        const athlete = await createUser('athlete');
        await createLink(professional, athlete);
        const trackingRecord = await createTrackingRecord(
          professional,
          athlete,
        );

        const response = await request(app)
          .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
          .set('Authorization', authorization(professional))
          .send({ status });

        expect(response.status).toBe(200);
        expect(response.body.data.trackingRecord.status).toBe(status);
        expect(response.body.data.trackingRecord.completedAt).toBeNull();
        expect(await TrackingRecord.countDocuments()).toBe(1);
      },
    );

    it.each(['completed', 'missed', 'cancelled'])(
      'impede que estado final %s sofra nova transição',
      async (status) => {
        const professional = await createUser('professional');
        const athlete = await createUser('athlete');
        await createLink(professional, athlete);
        const trackingRecord = await createTrackingRecord(
          professional,
          athlete,
          { status },
        );

        const response = await request(app)
          .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
          .set('Authorization', authorization(professional))
          .send({ status: 'scheduled' });

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
        expect((await TrackingRecord.findById(trackingRecord.id)).status).toBe(
          status,
        );
      },
    );

    it('aplica role, ownership e vínculo ativo nas transições', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const outsider = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      const link = await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(professional, athlete);

      const adminResponse = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(admin))
        .send({ status: 'completed' });
      const outsiderResponse = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(outsider))
        .send({ status: 'completed' });
      const athleteResponse = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(otherAthlete))
        .send({ status: 'completed' });

      expect(adminResponse.status).toBe(403);
      expect(outsiderResponse.status).toBe(404);
      expect(athleteResponse.status).toBe(404);

      link.status = 'ended';
      link.endedAt = new Date();
      await link.save();
      const endedResponse = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(professional))
        .send({ status: 'completed' });
      expect(endedResponse.status).toBe(404);
    });

    it('rejeita ID, recurso, status e completedAt inválidos', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const trackingRecord = await createTrackingRecord(professional, athlete);

      const invalidId = await request(app)
        .patch('/api/v1/tracking-records/id-invalido/status')
        .set('Authorization', authorization(professional))
        .send({ status: 'completed' });
      const missing = await request(app)
        .patch(
          `/api/v1/tracking-records/${new mongoose.Types.ObjectId()}/status`,
        )
        .set('Authorization', authorization(professional))
        .send({ status: 'completed' });
      const invalidPayload = await request(app)
        .patch(`/api/v1/tracking-records/${trackingRecord.id}/status`)
        .set('Authorization', authorization(professional))
        .send({ status: 'invalid', completedAt: 'data-inválida' });

      expect(invalidId.status).toBe(400);
      expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(invalidPayload.status).toBe(400);
      expect(invalidPayload.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('não disponibiliza exclusão física', async () => {
    const admin = await createUser('admin');
    const professional = await createUser('professional');
    const athlete = await createUser('athlete');
    const trackingRecord = await createTrackingRecord(professional, athlete);

    const response = await request(app)
      .delete(`/api/v1/tracking-records/${trackingRecord.id}`)
      .set('Authorization', authorization(admin));

    expect(response.status).toBe(404);
    expect(await TrackingRecord.findById(trackingRecord.id)).not.toBeNull();
  });
});
