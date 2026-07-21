const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const User = require('../../src/models/user');

const validRegistration = {
  name: 'Rafael Freire',
  email: 'rafael@example.com',
  password: 'SenhaForte123!',
};

async function createUser(overrides = {}) {
  const password = overrides.password || validRegistration.password;
  const passwordHash = await bcrypt.hash(password, 10);

  return User.create({
    name: 'Atleta Teste',
    email: 'atleta@example.com',
    passwordHash,
    role: 'athlete',
    ...overrides,
    passwordHash,
  });
}

describe('autenticação', () => {
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

  describe('POST /api/v1/auth/register', () => {
    it('cria somente atleta, armazena hash bcrypt e retorna JWT seguro', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegistration,
          email: '  RAFAEL@EXAMPLE.COM ',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.token).toEqual(expect.any(String));
      expect(response.body.data.user).toMatchObject({
        name: validRegistration.name,
        email: validRegistration.email,
        role: 'athlete',
        active: true,
      });
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      const storedUser = await User.findOne({
        email: validRegistration.email,
      }).select('+passwordHash');
      expect(storedUser.passwordHash).not.toBe(validRegistration.password);
      await expect(
        bcrypt.compare(validRegistration.password, storedUser.passwordHash),
      ).resolves.toBe(true);
    });

    it('rejeita campos desconhecidos, incluindo role', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.fields).toContainEqual({
        field: 'role',
        message: 'O campo role não é permitido.',
      });
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejeita payload inválido', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'R', email: 'inválido', password: 'curta' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.fields).toHaveLength(3);
    });

    it('retorna EMAIL_ALREADY_EXISTS para e-mail duplicado normalizado', async () => {
      await createUser({ email: validRegistration.email });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, email: 'RAFAEL@EXAMPLE.COM' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('retorna JWT sem hash e atualiza lastLoginAt', async () => {
      const user = await createUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: ' ATLETA@EXAMPLE.COM ', password: validRegistration.password });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toEqual(expect.any(String));
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      const updatedUser = await User.findById(user.id);
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date);
    });

    it('rejeita credenciais incorretas sem revelar qual campo falhou', async () => {
      await createUser();

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'atleta@example.com', password: 'SenhaErrada123!' });
      const unknownEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'outro@example.com', password: validRegistration.password });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.error.message).toBe(
        unknownEmail.body.error.message,
      );
    });

    it.each([
      ['bloqueado', { blockedAt: new Date() }],
      ['inativo', { active: false }],
    ])('impede login de usuário %s', async (_description, state) => {
      await createUser(state);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'atleta@example.com',
          password: validRegistration.password,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('USER_BLOCKED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('retorna o usuário autenticado sem passwordHash', async () => {
      await createUser();
      const login = await request(app).post('/api/v1/auth/login').send({
        email: 'atleta@example.com',
        password: validRegistration.password,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.data.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe('atleta@example.com');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('rejeita requisição sem token', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejeita token inválido', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token-invalido');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('PATCH /api/v1/auth/password', () => {
    it('altera a senha quando a senha atual está correta', async () => {
      await createUser();
      const login = await request(app).post('/api/v1/auth/login').send({
        email: 'atleta@example.com',
        password: validRegistration.password,
      });

      const response = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${login.body.data.token}`)
        .send({
          currentPassword: validRegistration.password,
          newPassword: 'NovaSenha123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      const oldLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'atleta@example.com',
        password: validRegistration.password,
      });
      const newLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'atleta@example.com',
        password: 'NovaSenha123!',
      });
      expect(oldLogin.status).toBe(401);
      expect(newLogin.status).toBe(200);
    });

    it('rejeita senha atual incorreta', async () => {
      await createUser();
      const login = await request(app).post('/api/v1/auth/login').send({
        email: 'atleta@example.com',
        password: validRegistration.password,
      });

      const response = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${login.body.data.token}`)
        .send({
          currentPassword: 'SenhaErrada123!',
          newPassword: 'NovaSenha123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
