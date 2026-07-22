const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const User = require('../../src/models/user');
const { generateToken } = require('../../src/utils/jwt');

async function createUser(overrides = {}) {
  return User.create({
    name: 'Usuário Teste',
    email: `user-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: await bcrypt.hash('SenhaForte123!', 10),
    role: 'athlete',
    ...overrides,
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

describe('gestão de usuários', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 120000);

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('GET /api/v1/users', () => {
    it('exige autenticação', async () => {
      const response = await request(app).get('/api/v1/users');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('impede listagem por usuário comum', async () => {
      const athlete = await createUser();

      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', authorization(athlete));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('lista com paginação, ordenação e sem passwordHash', async () => {
      const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
      await createUser({ name: 'Primeiro', email: 'primeiro@example.com' });
      await createUser({ name: 'Segundo', email: 'segundo@example.com' });

      const response = await request(app)
        .get('/api/v1/users?page=1&limit=2')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      response.body.data.forEach((user) => {
        expect(user).not.toHaveProperty('passwordHash');
      });
    });

    it('filtra por role, active e busca nome ou e-mail', async () => {
      const admin = await createUser({ role: 'admin', email: 'admin@example.com' });
      await createUser({
        name: 'Maria Profissional',
        email: 'maria@example.com',
        role: 'professional',
        active: true,
      });
      await createUser({
        name: 'Outra Profissional',
        email: 'outra@example.com',
        role: 'professional',
        active: false,
      });

      const response = await request(app)
        .get('/api/v1/users?role=professional&active=true&search=maria')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe('maria@example.com');
    });

    it('rejeita query inválida e campos desconhecidos', async () => {
      const admin = await createUser({ role: 'admin' });

      const response = await request(app)
        .get('/api/v1/users?limit=101&unknown=true')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('permite que o usuário consulte o próprio perfil', async () => {
      const athlete = await createUser();

      const response = await request(app)
        .get(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(athlete));

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe(athlete.id);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('impede acesso ao perfil de outro usuário', async () => {
      const athlete = await createUser();
      const other = await createUser();

      const response = await request(app)
        .get(`/api/v1/users/${other.id}`)
        .set('Authorization', authorization(athlete));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('permite que admin consulte outro usuário', async () => {
      const admin = await createUser({ role: 'admin' });
      const athlete = await createUser();

      const response = await request(app)
        .get(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe(athlete.id);
    });

    it('retorna RESOURCE_NOT_FOUND para usuário inexistente', async () => {
      const admin = await createUser({ role: 'admin' });
      const missingId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/users/${missingId}`)
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('retorna INVALID_OBJECT_ID para identificador inválido', async () => {
      const admin = await createUser({ role: 'admin' });

      const response = await request(app)
        .get('/api/v1/users/id-invalido')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_OBJECT_ID');
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('permite que usuário altere somente o próprio nome', async () => {
      const athlete = await createUser();

      const response = await request(app)
        .patch(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(athlete))
        .send({ name: 'Nome Atualizado' });

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe('Nome Atualizado');
    });

    it('impede que usuário altere o próprio role ou active', async () => {
      const athlete = await createUser();

      const response = await request(app)
        .patch(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(athlete))
        .send({ role: 'admin', active: false });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('impede que usuário altere outro perfil', async () => {
      const athlete = await createUser();
      const other = await createUser();

      const response = await request(app)
        .patch(`/api/v1/users/${other.id}`)
        .set('Authorization', authorization(athlete))
        .send({ name: 'Tentativa' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('permite que admin altere nome, role e active de outro usuário', async () => {
      const admin = await createUser({ role: 'admin' });
      const athlete = await createUser();

      const response = await request(app)
        .patch(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(admin))
        .send({ name: 'Novo Administrador', role: 'admin', active: false });

      expect(response.status).toBe(200);
      expect(response.body.data.user).toMatchObject({
        name: 'Novo Administrador',
        role: 'admin',
        active: false,
      });
    });

    it.each([
      ['promover para professional', 'athlete', 'professional'],
      ['remover o perfil professional', 'professional', 'athlete'],
    ])(
      'impede admin de %s fora do fluxo de verificação',
      async (_description, currentRole, requestedRole) => {
        const admin = await createUser({ role: 'admin' });
        const target = await createUser({ role: currentRole });

        const response = await request(app)
          .patch(`/api/v1/users/${target.id}`)
          .set('Authorization', authorization(admin))
          .send({ role: requestedRole });

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
        expect((await User.findById(target.id)).role).toBe(currentRole);
      },
    );

    it.each([
      ['desativado', { active: false }],
      ['ter o perfil alterado', { role: 'athlete' }],
    ])('protege o último admin ativo de ser %s', async (_case, update) => {
      const admin = await createUser({ role: 'admin' });

      const response = await request(app)
        .patch(`/api/v1/users/${admin.id}`)
        .set('Authorization', authorization(admin))
        .send(update);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('rejeita payload vazio ou campo desconhecido', async () => {
      const athlete = await createUser();

      const response = await request(app)
        .patch(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(athlete))
        .send({ email: 'novo@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/users/:id/block', () => {
    it('permite que admin bloqueie e desbloqueie outro usuário', async () => {
      const admin = await createUser({ role: 'admin' });
      const athlete = await createUser();

      const blocked = await request(app)
        .patch(`/api/v1/users/${athlete.id}/block`)
        .set('Authorization', authorization(admin))
        .send({ blocked: true });
      expect(blocked.status).toBe(200);

      const denied = await request(app)
        .get(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(athlete));
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('USER_BLOCKED');

      const unblocked = await request(app)
        .patch(`/api/v1/users/${athlete.id}/block`)
        .set('Authorization', authorization(admin))
        .send({ blocked: false });
      expect(unblocked.status).toBe(200);

      const allowed = await request(app)
        .get(`/api/v1/users/${athlete.id}`)
        .set('Authorization', authorization(athlete));
      expect(allowed.status).toBe(200);
    });

    it('impede que admin bloqueie a própria conta', async () => {
      const admin = await createUser({ role: 'admin' });

      const response = await request(app)
        .patch(`/api/v1/users/${admin.id}/block`)
        .set('Authorization', authorization(admin))
        .send({ blocked: true });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('impede bloqueio por usuário comum', async () => {
      const athlete = await createUser();
      const other = await createUser();

      const response = await request(app)
        .patch(`/api/v1/users/${other.id}/block`)
        .set('Authorization', authorization(athlete))
        .send({ blocked: true });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});
