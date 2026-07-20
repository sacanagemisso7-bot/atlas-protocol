const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const ProfessionalAthleteLink = require('../../src/models/professional-athlete-link');
const User = require('../../src/models/user');
const { generateToken } = require('../../src/utils/jwt');

async function createUser(role, overrides = {}) {
  return User.create({
    name: `Usuário ${role}`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: await bcrypt.hash('SenhaForte123!', 10),
    role,
    ...overrides,
  });
}

async function createLink(professional, athlete, overrides = {}) {
  return ProfessionalAthleteLink.create({
    professionalId: professional.id,
    athleteId: athlete.id,
    status: 'active',
    startedAt: new Date(),
    ...overrides,
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

describe('vínculos profissional-atleta', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await ProfessionalAthleteLink.init();
  }, 120000);

  afterEach(async () => {
    await Promise.all([
      ProfessionalAthleteLink.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/links', () => {
    it('permite que admin crie vínculo ativo válido', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');

      const response = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(admin))
        .send({ professionalId: professional.id, athleteId: athlete.id });

      expect(response.status).toBe(201);
      expect(response.body.data.link).toMatchObject({
        professionalId: professional.id,
        athleteId: athlete.id,
        status: 'active',
        invitedBy: admin.id,
      });
      expect(response.body.data.link.startedAt).toEqual(expect.any(String));
      expect(response.body.data.link.endedAt).toBeNull();
    });

    it('exige autenticação e perfil admin', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');

      const unauthenticated = await request(app)
        .post('/api/v1/links')
        .send({ professionalId: professional.id, athleteId: athlete.id });
      const forbidden = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(professional))
        .send({ professionalId: professional.id, athleteId: athlete.id });

      expect(unauthenticated.status).toBe(401);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
    });

    it.each([
      ['professionalId', 'athlete', 'athlete'],
      ['athleteId', 'professional', 'professional'],
    ])(
      'rejeita perfil incompatível em %s',
      async (field, suppliedRole, otherRole) => {
        const admin = await createUser('admin');
        const suppliedUser = await createUser(suppliedRole);
        const otherUser = await createUser(otherRole);
        const payload = {
          professionalId:
            field === 'professionalId' ? suppliedUser.id : otherUser.id,
          athleteId: field === 'athleteId' ? suppliedUser.id : otherUser.id,
        };

        const response = await request(app)
          .post('/api/v1/links')
          .set('Authorization', authorization(admin))
          .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.fields[0].field).toBe(field);
      },
    );

    it('retorna RESOURCE_NOT_FOUND para usuário inexistente', async () => {
      const admin = await createUser('admin');
      const athlete = await createUser('athlete');

      const response = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(admin))
        .send({
          professionalId: new mongoose.Types.ObjectId().toString(),
          athleteId: athlete.id,
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejeita vínculo do usuário consigo mesmo', async () => {
      const admin = await createUser('admin');
      const user = await createUser('professional');

      const response = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(admin))
        .send({ professionalId: user.id, athleteId: user.id });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('retorna INVALID_OBJECT_ID para identificador inválido', async () => {
      const admin = await createUser('admin');
      const athlete = await createUser('athlete');

      const response = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(admin))
        .send({ professionalId: 'inválido', athleteId: athlete.id });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_OBJECT_ID');
    });

    it('impede vínculo ativo duplicado para o mesmo par', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);

      const response = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(admin))
        .send({ professionalId: professional.id, athleteId: athlete.id });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ACTIVE_LINK_ALREADY_EXISTS');
      expect(await ProfessionalAthleteLink.countDocuments()).toBe(1);
    });

    it('permite novo vínculo após o anterior ter sido encerrado', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete, {
        status: 'ended',
        endedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/links')
        .set('Authorization', authorization(admin))
        .send({ professionalId: professional.id, athleteId: athlete.id });

      expect(response.status).toBe(201);
      expect(await ProfessionalAthleteLink.countDocuments()).toBe(2);
    });
  });

  describe('GET /api/v1/links', () => {
    it('permite que admin liste todos com paginação e filtros', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athleteOne = await createUser('athlete');
      const athleteTwo = await createUser('athlete');
      await createLink(professional, athleteOne);
      await createLink(professional, athleteTwo, {
        status: 'ended',
        endedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/v1/links?status=active&professionalId=${professional.id}&page=1&limit=1`)
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('active');
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });

    it('profissional lista somente os próprios vínculos', async () => {
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createLink(professional, athlete);
      await createLink(otherProfessional, athlete);

      const response = await request(app)
        .get(`/api/v1/links?professionalId=${otherProfessional.id}`)
        .set('Authorization', authorization(professional));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].professionalId).toBe(professional.id);
    });

    it('atleta lista somente os próprios vínculos', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      await createLink(professional, athlete);
      await createLink(professional, otherAthlete);

      const response = await request(app)
        .get(`/api/v1/links?athleteId=${otherAthlete.id}`)
        .set('Authorization', authorization(athlete));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].athleteId).toBe(athlete.id);
    });

    it('rejeita filtro e paginação inválidos', async () => {
      const admin = await createUser('admin');

      const response = await request(app)
        .get('/api/v1/links?status=invalid&limit=101')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/links/:id', () => {
    it.each(['admin', 'professional', 'athlete'])(
      'permite consulta pelo perfil %s quando autorizado',
      async (role) => {
        const admin = await createUser('admin');
        const professional = await createUser('professional');
        const athlete = await createUser('athlete');
        const link = await createLink(professional, athlete);
        const requester = { admin, professional, athlete }[role];

        const response = await request(app)
          .get(`/api/v1/links/${link.id}`)
          .set('Authorization', authorization(requester));

        expect(response.status).toBe(200);
        expect(response.body.data.link.id).toBe(link.id);
      },
    );

    it('oculta vínculo de usuário externo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('athlete');
      const link = await createLink(professional, athlete);

      const response = await request(app)
        .get(`/api/v1/links/${link.id}`)
        .set('Authorization', authorization(outsider));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('retorna recurso inexistente e ObjectId inválido corretamente', async () => {
      const admin = await createUser('admin');
      const missing = await request(app)
        .get(`/api/v1/links/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', authorization(admin));
      const invalid = await request(app)
        .get('/api/v1/links/id-invalido')
        .set('Authorization', authorization(admin));

      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
    });
  });

  describe('PATCH /api/v1/links/:id/end', () => {
    it.each(['admin', 'professional', 'athlete'])(
      'permite encerramento pelo perfil %s e mantém o histórico',
      async (role) => {
        const admin = await createUser('admin');
        const professional = await createUser('professional');
        const athlete = await createUser('athlete');
        const link = await createLink(professional, athlete);
        const requester = { admin, professional, athlete }[role];

        const response = await request(app)
          .patch(`/api/v1/links/${link.id}/end`)
          .set('Authorization', authorization(requester))
          .send({ reason: 'Encerramento do acompanhamento.' });

        expect(response.status).toBe(200);
        expect(response.body.data.link.status).toBe('ended');
        expect(response.body.data.link.endedAt).toEqual(expect.any(String));
        expect(await ProfessionalAthleteLink.countDocuments()).toBe(1);
      },
    );

    it('rejeita encerramento repetido', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const link = await createLink(professional, athlete, {
        status: 'ended',
        endedAt: new Date(),
      });

      const response = await request(app)
        .patch(`/api/v1/links/${link.id}/end`)
        .set('Authorization', authorization(admin))
        .send({ reason: 'Nova tentativa de encerramento.' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('oculta vínculo de usuário externo', async () => {
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('professional');
      const link = await createLink(professional, athlete);

      const response = await request(app)
        .patch(`/api/v1/links/${link.id}/end`)
        .set('Authorization', authorization(outsider))
        .send({ reason: 'Tentativa indevida.' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect((await ProfessionalAthleteLink.findById(link.id)).status).toBe(
        'active',
      );
    });

    it('rejeita payload inválido', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const link = await createLink(professional, athlete);

      const response = await request(app)
        .patch(`/api/v1/links/${link.id}/end`)
        .set('Authorization', authorization(admin))
        .send({ reason: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
