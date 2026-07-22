const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const CheckIn = require('../../src/models/check-in');
const ProfessionalAthleteLink = require('../../src/models/professional-athlete-link');
const Protocol = require('../../src/models/protocol');
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
    currentVersion: 2,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    continuous: true,
    activatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  });
}

async function createCheckIn(professional, athlete, overrides = {}) {
  const status = overrides.status || 'pending';
  const submittedAt =
    overrides.submittedAt !== undefined
      ? overrides.submittedAt
      : ['submitted', 'reviewed'].includes(status)
        ? new Date('2026-08-09T18:00:00.000Z')
        : null;
  const reviewedAt =
    overrides.reviewedAt !== undefined
      ? overrides.reviewedAt
      : status === 'reviewed'
        ? new Date('2026-08-10T12:00:00.000Z')
        : null;

  return CheckIn.create({
    athleteId: athlete.id,
    professionalId: professional.id,
    protocolId: null,
    referenceWeek: new Date('2026-08-03T03:00:00.000Z'),
    status,
    answers: {
      weightKg: 80.5,
      sleepHours: 7.5,
      energyScore: 8,
      adherenceScore: 9,
      reportedEffects: ['Relato informado pelo atleta.'],
      notes: 'Semana registrada sem interpretação clínica.',
    },
    submittedAt,
    reviewedAt,
    reviewedBy: status === 'reviewed' ? professional.id : null,
    reviewComment:
      status === 'reviewed' ? 'Comentário profissional registrado.' : null,
    ...overrides,
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

function checkInPayload(overrides = {}) {
  return {
    referenceWeek: '2026-08-09T23:30:00-03:00',
    answers: {
      weightKg: 80.5,
      sleepHours: 7.5,
      energyScore: 8,
      adherenceScore: 9,
      reportedEffects: ['Observação relatada pelo atleta.'],
      notes: 'Semana estável segundo o relato.',
    },
    ...overrides,
  };
}

describe('check-ins', () => {
  let mongoServer;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('SenhaForte123!', 10);
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([CheckIn.init(), ProfessionalAthleteLink.init()]);
  }, 120000);

  afterEach(async () => {
    await Promise.all([
      CheckIn.deleteMany({}),
      Protocol.deleteMany({}),
      ProfessionalAthleteLink.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/check-ins', () => {
    it('permite que athlete crie pending próprio e normaliza a semana em São Paulo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const response = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(checkInPayload());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          checkIn: {
            athleteId: athlete.id,
            professionalId: professional.id,
            protocolId: null,
            referenceWeek: '2026-08-03T03:00:00.000Z',
            status: 'pending',
            submittedAt: null,
            reviewedAt: null,
            reviewedBy: null,
            reviewComment: null,
          },
        },
      });
      expect(response.body.data.checkIn.answers).toEqual(
        checkInPayload().answers,
      );
    });

    it('infere professional pelo protocolo ativo mesmo com múltiplos vínculos', async () => {
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      await createLink(otherProfessional, athlete);
      const protocol = await createProtocol(professional, athlete);

      const response = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(checkInPayload({ protocolId: protocol.id }));

      expect(response.status).toBe(201);
      expect(response.body.data.checkIn).toMatchObject({
        athleteId: athlete.id,
        professionalId: professional.id,
        protocolId: protocol.id,
      });
    });

    it('exige autenticação e permite criação somente para athlete', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');

      const unauthenticated = await request(app)
        .post('/api/v1/check-ins')
        .send(checkInPayload());
      const adminResponse = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(admin))
        .send(checkInPayload());
      const professionalResponse = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(professional))
        .send(checkInPayload());

      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body.error.code).toBe('AUTH_REQUIRED');
      expect(adminResponse.status).toBe(403);
      expect(adminResponse.body.error.code).toBe('FORBIDDEN');
      expect(professionalResponse.status).toBe(403);
      expect(professionalResponse.body.error.code).toBe('FORBIDDEN');
    });

    it('rejeita ausência, encerramento e ambiguidade de vínculo', async () => {
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athleteWithoutLink = await createUser('athlete');
      const athleteWithEndedLink = await createUser('athlete');
      const athleteWithAmbiguousLink = await createUser('athlete');
      await createLink(professional, athleteWithEndedLink, {
        status: 'ended',
        endedAt: new Date('2026-07-10T00:00:00.000Z'),
      });
      await createLink(professional, athleteWithAmbiguousLink);
      await createLink(otherProfessional, athleteWithAmbiguousLink);

      const cases = [
        { athlete: athleteWithoutLink, status: 403, code: 'FORBIDDEN' },
        { athlete: athleteWithEndedLink, status: 403, code: 'FORBIDDEN' },
        {
          athlete: athleteWithAmbiguousLink,
          status: 400,
          code: 'VALIDATION_ERROR',
        },
      ];

      for (const currentCase of cases) {
        const response = await request(app)
          .post('/api/v1/check-ins')
          .set('Authorization', authorization(currentCase.athlete))
          .send(checkInPayload());

        expect(response.status).toBe(currentCase.status);
        expect(response.body.error.code).toBe(currentCase.code);
      }
      expect(await CheckIn.countDocuments()).toBe(0);
    });

    it('impede duplicidade do mesmo athlete na mesma semana local', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const first = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(checkInPayload());
      const duplicate = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(
          checkInPayload({
            referenceWeek: '2026-08-04T12:00:00-03:00',
          }),
        );

      expect(first.status).toBe(201);
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('CHECKIN_ALREADY_EXISTS');
      expect(await CheckIn.countDocuments()).toBe(1);
    });

    it('permite semanas diferentes para o mesmo athlete', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const first = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(checkInPayload());
      const nextWeek = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(
          checkInPayload({
            referenceWeek: '2026-08-10T12:00:00-03:00',
          }),
        );

      expect(first.status).toBe(201);
      expect(nextWeek.status).toBe(201);
      expect(await CheckIn.countDocuments()).toBe(2);
    });

    it('valida existência, atleta e status do protocolo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createLink(professional, athlete);
      const otherAthleteProtocol = await createProtocol(
        professional,
        otherAthlete,
      );
      const inactiveProtocol = await createProtocol(professional, athlete, {
        status: 'paused',
        pausedAt: new Date('2026-07-20T00:00:00.000Z'),
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
          protocolId: inactiveProtocol.id,
          expectedStatus: 422,
          expectedCode: 'INVALID_STATE_TRANSITION',
        },
      ];

      for (const currentCase of cases) {
        const response = await request(app)
          .post('/api/v1/check-ins')
          .set('Authorization', authorization(athlete))
          .send(checkInPayload({ protocolId: currentCase.protocolId }));

        expect(response.status).toBe(currentCase.expectedStatus);
        expect(response.body.error.code).toBe(currentCase.expectedCode);
      }
      expect(await CheckIn.countDocuments()).toBe(0);
    });

    it('rejeita ObjectId inválido, campos internos e dados desconhecidos', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createLink(professional, athlete);

      const invalidId = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(checkInPayload({ protocolId: 'id-invalido' }));
      const injected = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send({
          ...checkInPayload(),
          athleteId: otherAthlete.id,
          professionalId: professional.id,
          status: 'reviewed',
          submittedAt: new Date().toISOString(),
          reviewedAt: new Date().toISOString(),
          reviewedBy: professional.id,
          professionalNotes: 'Campo não permitido.',
        });

      expect(invalidId.status).toBe(400);
      expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(injected.status).toBe(400);
      expect(injected.body.error.code).toBe('VALIDATION_ERROR');
      expect(await CheckIn.countDocuments()).toBe(0);
    });

    it('valida referenceWeek, limites das respostas e campos aninhados', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const invalidDate = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(checkInPayload({ referenceWeek: 'data-inválida' }));
      const invalidAnswers = await request(app)
        .post('/api/v1/check-ins')
        .set('Authorization', authorization(athlete))
        .send(
          checkInPayload({
            answers: {
              weightKg: 0,
              sleepHours: 25,
              energyScore: 11,
              adherenceScore: -1,
              reportedEffects: [],
              notes: null,
              diagnosis: 'não permitido',
            },
          }),
        );

      expect(invalidDate.status).toBe(400);
      expect(invalidDate.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidAnswers.status).toBe(400);
      expect(invalidAnswers.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/check-ins', () => {
    it('permite que admin filtre, ordene e pagine todos os check-ins', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      const protocol = await createProtocol(professional, athlete);
      await createCheckIn(professional, athlete, {
        protocolId: protocol.id,
        status: 'submitted',
        referenceWeek: new Date('2026-08-03T03:00:00.000Z'),
        submittedAt: new Date('2026-08-09T10:00:00.000Z'),
      });
      await createCheckIn(professional, athlete, {
        referenceWeek: new Date('2026-08-10T03:00:00.000Z'),
        status: 'submitted',
        submittedAt: new Date('2026-08-16T10:00:00.000Z'),
      });
      await createCheckIn(otherProfessional, otherAthlete, {
        referenceWeek: new Date('2026-08-17T03:00:00.000Z'),
        status: 'submitted',
        submittedAt: new Date('2026-08-23T10:00:00.000Z'),
      });

      const filtered = await request(app)
        .get(
          `/api/v1/check-ins?athleteId=${athlete.id}&protocolId=${protocol.id}&status=submitted&dateFrom=2026-08-03T00:00:00.000Z&dateTo=2026-08-09T23:59:59.999Z&sortBy=submittedAt&sortOrder=asc`,
        )
        .set('Authorization', authorization(admin));
      const paginated = await request(app)
        .get(
          '/api/v1/check-ins?page=2&limit=1&sortBy=submittedAt&sortOrder=asc',
        )
        .set('Authorization', authorization(admin));

      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0]).toMatchObject({
        athleteId: athlete.id,
        professionalId: professional.id,
        protocolId: protocol.id,
        status: 'submitted',
      });
      expect(paginated.status).toBe(200);
      expect(paginated.body.data[0].submittedAt).toBe(
        '2026-08-16T10:00:00.000Z',
      );
      expect(paginated.body.meta).toEqual({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
    });

    it('restringe professional aos athletes com vínculo ativo', async () => {
      const professional = await createUser('professional');
      const recordAuthor = await createUser('professional');
      const linkedAthlete = await createUser('athlete');
      const endedAthlete = await createUser('athlete');
      await createLink(professional, linkedAthlete);
      await createLink(professional, endedAthlete, {
        status: 'ended',
        endedAt: new Date('2026-07-10T00:00:00.000Z'),
      });
      await createCheckIn(recordAuthor, linkedAthlete);
      await createCheckIn(recordAuthor, endedAthlete);

      const normal = await request(app)
        .get('/api/v1/check-ins')
        .set('Authorization', authorization(professional));
      const attemptedExpansion = await request(app)
        .get(`/api/v1/check-ins?athleteId=${endedAthlete.id}`)
        .set('Authorization', authorization(professional));

      expect(normal.status).toBe(200);
      expect(normal.body.data).toHaveLength(1);
      expect(normal.body.data[0].athleteId).toBe(linkedAthlete.id);
      expect(attemptedExpansion.body.data).toHaveLength(1);
      expect(attemptedExpansion.body.data[0].athleteId).toBe(linkedAthlete.id);
    });

    it('restringe athlete ao próprio histórico mesmo com filtro externo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createCheckIn(professional, athlete);
      await createCheckIn(professional, otherAthlete);

      const response = await request(app)
        .get(`/api/v1/check-ins?athleteId=${otherAthlete.id}`)
        .set('Authorization', authorization(athlete));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].athleteId).toBe(athlete.id);
    });

    it('exige autenticação e rejeita query inválida', async () => {
      const admin = await createUser('admin');
      const unauthenticated = await request(app).get('/api/v1/check-ins');
      const invalid = await request(app)
        .get(
          '/api/v1/check-ins?limit=101&status=invalid&sortBy=referenceWeek&extra=true',
        )
        .set('Authorization', authorization(admin));

      expect(unauthenticated.status).toBe(401);
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/check-ins/:id', () => {
    it('permite consulta por admin, professional vinculado e próprio athlete', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const recordAuthor = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const checkIn = await createCheckIn(recordAuthor, athlete);

      for (const requester of [admin, professional, athlete]) {
        const response = await request(app)
          .get(`/api/v1/check-ins/${checkIn.id}`)
          .set('Authorization', authorization(requester));

        expect(response.status).toBe(200);
        expect(response.body.data.checkIn.id).toBe(checkIn.id);
      }
    });

    it('oculta de usuário externo e professional com vínculo encerrado', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('athlete');
      const link = await createLink(professional, athlete);
      const checkIn = await createCheckIn(professional, athlete);
      link.status = 'ended';
      link.endedAt = new Date();
      await link.save();

      for (const requester of [professional, outsider]) {
        const response = await request(app)
          .get(`/api/v1/check-ins/${checkIn.id}`)
          .set('Authorization', authorization(requester));

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      }
    });

    it('retorna erros para recurso inexistente e ObjectId inválido', async () => {
      const admin = await createUser('admin');
      const missing = await request(app)
        .get(`/api/v1/check-ins/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', authorization(admin));
      const invalid = await request(app)
        .get('/api/v1/check-ins/id-invalido')
        .set('Authorization', authorization(admin));

      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
    });
  });

  describe('PATCH /api/v1/check-ins/:id', () => {
    it('permite que athlete altere apenas respostas do próprio pending', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const checkIn = await createCheckIn(professional, athlete);

      const response = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}`)
        .set('Authorization', authorization(athlete))
        .send({
          answers: {
            energyScore: 6,
            notes: 'Relato atualizado pelo atleta.',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.checkIn.answers).toMatchObject({
        energyScore: 6,
        sleepHours: 7.5,
        notes: 'Relato atualizado pelo atleta.',
      });
      expect(response.body.data.checkIn.status).toBe('pending');
    });

    it('impede professional, admin e outro athlete de alterar respostas', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('athlete');
      await createLink(professional, athlete);
      const checkIn = await createCheckIn(professional, athlete);

      for (const requester of [admin, professional]) {
        const response = await request(app)
          .patch(`/api/v1/check-ins/${checkIn.id}`)
          .set('Authorization', authorization(requester))
          .send({ answers: { notes: 'Tentativa indevida.' } });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }

      const outsiderResponse = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}`)
        .set('Authorization', authorization(outsider))
        .send({ answers: { notes: 'Tentativa externa.' } });
      expect(outsiderResponse.status).toBe(404);

      const unchanged = await CheckIn.findById(checkIn.id);
      expect(unchanged.answers.notes).toBe(
        'Semana registrada sem interpretação clínica.',
      );
    });

    it('torna submitted e reviewed imutáveis para o athlete', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const submitted = await createCheckIn(professional, athlete, {
        status: 'submitted',
      });
      const reviewed = await createCheckIn(professional, athlete, {
        referenceWeek: new Date('2026-08-10T03:00:00.000Z'),
        status: 'reviewed',
      });

      const submittedResponse = await request(app)
        .patch(`/api/v1/check-ins/${submitted.id}`)
        .set('Authorization', authorization(athlete))
        .send({ answers: { energyScore: 1 } });
      const reviewedResponse = await request(app)
        .patch(`/api/v1/check-ins/${reviewed.id}`)
        .set('Authorization', authorization(athlete))
        .send({ answers: { energyScore: 1 } });

      expect(submittedResponse.status).toBe(422);
      expect(submittedResponse.body.error.code).toBe(
        'INVALID_STATE_TRANSITION',
      );
      expect(reviewedResponse.status).toBe(422);
      expect(reviewedResponse.body.error.code).toBe(
        'INVALID_STATE_TRANSITION',
      );
      expect((await CheckIn.findById(submitted.id)).answers.energyScore).toBe(8);
      expect((await CheckIn.findById(reviewed.id)).answers.energyScore).toBe(8);
    });

    it('rejeita payload, recurso e identificador inválidos', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const checkIn = await createCheckIn(professional, athlete);

      const empty = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}`)
        .set('Authorization', authorization(athlete))
        .send({});
      const injected = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}`)
        .set('Authorization', authorization(athlete))
        .send({
          status: 'reviewed',
          reviewComment: 'Injeção.',
          answers: { diagnosis: 'não permitido' },
        });
      const invalidId = await request(app)
        .patch('/api/v1/check-ins/id-invalido')
        .set('Authorization', authorization(athlete))
        .send({ answers: { energyScore: 5 } });
      const missing = await request(app)
        .patch(`/api/v1/check-ins/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', authorization(athlete))
        .send({ answers: { energyScore: 5 } });

      expect(empty.status).toBe(400);
      expect(empty.body.error.code).toBe('VALIDATION_ERROR');
      expect(injected.status).toBe(400);
      expect(injected.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/check-ins/:id/submit', () => {
    it('permite envio do próprio pending e registra submittedAt', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const checkIn = await createCheckIn(professional, athlete);
      const answersBefore = checkIn.answers.toObject();
      const before = Date.now();

      const response = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/submit`)
        .set('Authorization', authorization(athlete))
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.checkIn.status).toBe('submitted');
      expect(new Date(response.body.data.checkIn.submittedAt).getTime()).toBeGreaterThanOrEqual(before);
      expect(response.body.data.checkIn.answers).toMatchObject(answersBefore);
    });

    it('impede reenvio e envio de check-in reviewed', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const submitted = await createCheckIn(professional, athlete, {
        status: 'submitted',
      });
      const reviewed = await createCheckIn(professional, athlete, {
        referenceWeek: new Date('2026-08-10T03:00:00.000Z'),
        status: 'reviewed',
      });

      const repeated = await request(app)
        .patch(`/api/v1/check-ins/${submitted.id}/submit`)
        .set('Authorization', authorization(athlete))
        .send({});
      const immutable = await request(app)
        .patch(`/api/v1/check-ins/${reviewed.id}/submit`)
        .set('Authorization', authorization(athlete))
        .send({});

      expect(repeated.status).toBe(422);
      expect(repeated.body.error.code).toBe('INVALID_STATE_TRANSITION');
      expect(immutable.status).toBe(422);
      expect(immutable.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('aplica role, ownership e validação da requisição', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('athlete');
      const checkIn = await createCheckIn(professional, athlete);

      for (const requester of [admin, professional]) {
        const response = await request(app)
          .patch(`/api/v1/check-ins/${checkIn.id}/submit`)
          .set('Authorization', authorization(requester))
          .send({});
        expect(response.status).toBe(403);
      }

      const hidden = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/submit`)
        .set('Authorization', authorization(outsider))
        .send({});
      const invalidBody = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/submit`)
        .set('Authorization', authorization(athlete))
        .send({ submittedAt: new Date().toISOString() });
      const invalidId = await request(app)
        .patch('/api/v1/check-ins/id-invalido/submit')
        .set('Authorization', authorization(athlete))
        .send({});
      const missing = await request(app)
        .patch(`/api/v1/check-ins/${new mongoose.Types.ObjectId()}/submit`)
        .set('Authorization', authorization(athlete))
        .send({});

      expect(hidden.status).toBe(404);
      expect(hidden.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(invalidBody.status).toBe(400);
      expect(invalidBody.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/check-ins/:id/review', () => {
    it('permite revisão por professional vinculado sem alterar respostas', async () => {
      const professional = await createUser('professional');
      const recordProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const checkIn = await createCheckIn(recordProfessional, athlete, {
        status: 'submitted',
      });
      const answersBefore = checkIn.answers.toObject();
      const before = Date.now();

      const response = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/review`)
        .set('Authorization', authorization(professional))
        .send({ reviewComment: 'Feedback de acompanhamento registrado.' });

      expect(response.status).toBe(200);
      expect(response.body.data.checkIn).toMatchObject({
        status: 'reviewed',
        reviewedBy: professional.id,
        reviewComment: 'Feedback de acompanhamento registrado.',
      });
      expect(new Date(response.body.data.checkIn.reviewedAt).getTime()).toBeGreaterThanOrEqual(before);
      expect(response.body.data.checkIn.answers).toMatchObject(answersBefore);

      const stored = await CheckIn.findById(checkIn.id);
      expect(stored.answers.toObject()).toMatchObject(answersBefore);
    });

    it('impede revisão por admin, athlete, professional externo ou vínculo encerrado', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const outsider = await createUser('professional');
      const athlete = await createUser('athlete');
      const link = await createLink(professional, athlete);
      const checkIn = await createCheckIn(professional, athlete, {
        status: 'submitted',
      });

      for (const requester of [admin, athlete]) {
        const response = await request(app)
          .patch(`/api/v1/check-ins/${checkIn.id}/review`)
          .set('Authorization', authorization(requester))
          .send({ reviewComment: 'Tentativa sem permissão.' });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }

      const outsiderResponse = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/review`)
        .set('Authorization', authorization(outsider))
        .send({ reviewComment: 'Tentativa externa.' });
      expect(outsiderResponse.status).toBe(404);

      link.status = 'ended';
      link.endedAt = new Date();
      await link.save();
      const endedResponse = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/review`)
        .set('Authorization', authorization(professional))
        .send({ reviewComment: 'Tentativa após encerramento.' });
      expect(endedResponse.status).toBe(404);
      expect((await CheckIn.findById(checkIn.id)).status).toBe('submitted');
    });

    it('rejeita revisão de pending, repetição e alteração de respostas', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const pending = await createCheckIn(professional, athlete);
      const reviewed = await createCheckIn(professional, athlete, {
        referenceWeek: new Date('2026-08-10T03:00:00.000Z'),
        status: 'reviewed',
      });

      const pendingResponse = await request(app)
        .patch(`/api/v1/check-ins/${pending.id}/review`)
        .set('Authorization', authorization(professional))
        .send({ reviewComment: 'Ainda não enviado.' });
      const repeated = await request(app)
        .patch(`/api/v1/check-ins/${reviewed.id}/review`)
        .set('Authorization', authorization(professional))
        .send({ reviewComment: 'Nova tentativa.' });
      const injected = await request(app)
        .patch(`/api/v1/check-ins/${reviewed.id}/review`)
        .set('Authorization', authorization(professional))
        .send({
          reviewComment: 'Nova tentativa.',
          answers: { energyScore: 1 },
        });

      expect(pendingResponse.status).toBe(422);
      expect(pendingResponse.body.error.code).toBe(
        'INVALID_STATE_TRANSITION',
      );
      expect(repeated.status).toBe(422);
      expect(repeated.body.error.code).toBe('INVALID_STATE_TRANSITION');
      expect(injected.status).toBe(400);
      expect(injected.body.error.code).toBe('VALIDATION_ERROR');
      expect((await CheckIn.findById(reviewed.id)).answers.energyScore).toBe(8);
    });

    it('exige comentário e valida ID e recurso', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      const checkIn = await createCheckIn(professional, athlete, {
        status: 'submitted',
      });

      const invalidComment = await request(app)
        .patch(`/api/v1/check-ins/${checkIn.id}/review`)
        .set('Authorization', authorization(professional))
        .send({ reviewComment: '' });
      const invalidId = await request(app)
        .patch('/api/v1/check-ins/id-invalido/review')
        .set('Authorization', authorization(professional))
        .send({ reviewComment: 'Comentário válido.' });
      const missing = await request(app)
        .patch(`/api/v1/check-ins/${new mongoose.Types.ObjectId()}/review`)
        .set('Authorization', authorization(professional))
        .send({ reviewComment: 'Comentário válido.' });

      expect(invalidComment.status).toBe(400);
      expect(invalidComment.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidId.status).toBe(400);
      expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  it('não disponibiliza exclusão física', async () => {
    const admin = await createUser('admin');
    const professional = await createUser('professional');
    const athlete = await createUser('athlete');
    const checkIn = await createCheckIn(professional, athlete);

    const response = await request(app)
      .delete(`/api/v1/check-ins/${checkIn.id}`)
      .set('Authorization', authorization(admin));

    expect(response.status).toBe(404);
    expect(await CheckIn.findById(checkIn.id)).not.toBeNull();
  });
});
