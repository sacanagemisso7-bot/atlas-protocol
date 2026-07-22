const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const ProfessionalProfile = require('../../src/models/professional-profile');
const User = require('../../src/models/user');
const { generateToken } = require('../../src/utils/jwt');

const password = 'SenhaForte123!';

async function createUser(role, overrides = {}) {
  return User.create({
    name: `Usuario ${role}`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    ...overrides,
  });
}

async function createProfessionalProfile(user, overrides = {}) {
  return ProfessionalProfile.create({
    userId: user.id,
    verificationStatus: 'pending',
    verificationDocument: {
      storageKey: `professional-documents/private/${user.id}.pdf`,
      url: `file:///private/${user.id}.pdf`,
      originalName: 'comprovante.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 512,
    },
    ...overrides,
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

function expectNoSensitiveData(body) {
  const serialized = JSON.stringify(body);
  for (const forbidden of [
    'passwordHash',
    'storageKey',
    'file:///private/',
    'professional-documents/private/',
    '"url"',
    '"path"',
    '"buffer"',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe('verificacao profissional', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([ProfessionalProfile.init(), User.init()]);
  }, 120000);

  afterEach(async () => {
    await Promise.all([
      ProfessionalProfile.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('GET /api/v1/professional-verifications', () => {
    it('exige autenticacao', async () => {
      const response = await request(app).get(
        '/api/v1/professional-verifications',
      );

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it.each(['professional', 'athlete'])(
      'impede listagem pelo perfil %s',
      async (role) => {
        const user = await createUser(role);

        const response = await request(app)
          .get('/api/v1/professional-verifications')
          .set('Authorization', authorization(user));

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      },
    );

    it('busca nome ou email antes de paginar e filtra por status', async () => {
      const admin = await createUser('admin');
      const first = await createUser('professional', {
        name: 'Equipe Alfa',
        email: 'alfa@example.com',
      });
      const second = await createUser('professional', {
        name: 'Profissional Beta',
        email: 'equipe.beta@example.com',
      });
      const ignored = await createUser('professional', {
        name: 'Equipe Aprovada',
        email: 'aprovada@example.com',
      });
      await createProfessionalProfile(first);
      await createProfessionalProfile(second);
      await createProfessionalProfile(ignored, {
        verificationStatus: 'approved',
        reviewedAt: new Date(),
        reviewedBy: admin.id,
      });

      const firstPage = await request(app)
        .get(
          '/api/v1/professional-verifications?status=pending&search=equipe&page=1&limit=1',
        )
        .set('Authorization', authorization(admin));
      const secondPage = await request(app)
        .get(
          '/api/v1/professional-verifications?status=pending&search=equipe&page=2&limit=1',
        )
        .set('Authorization', authorization(admin));

      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      expect(firstPage.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      expect(secondPage.body.meta).toEqual({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      expect(
        new Set([
          firstPage.body.data[0].user.email,
          secondPage.body.data[0].user.email,
        ]),
      ).toEqual(new Set(['alfa@example.com', 'equipe.beta@example.com']));
      expectNoSensitiveData(firstPage.body);
      expect(firstPage.body.data[0]).not.toHaveProperty(
        'verificationDocument',
      );
    });

    it('rejeita filtros, paginacao e campos desconhecidos invalidos', async () => {
      const admin = await createUser('admin');

      const response = await request(app)
        .get(
          '/api/v1/professional-verifications?status=invalid&limit=101&extra=true',
        )
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/professional-verifications/me', () => {
    it.each(['pending', 'rejected'])(
      'permite que profissional %s consulte a propria situacao',
      async (verificationStatus) => {
        const reviewer = await createUser('admin');
        const professional = await createUser('professional');
        const reviewedFields =
          verificationStatus === 'rejected'
            ? {
                reviewedAt: new Date(),
                reviewedBy: reviewer.id,
                rejectionReason: 'Documento insuficiente.',
              }
            : {};
        await createProfessionalProfile(professional, {
          verificationStatus,
          ...reviewedFields,
        });

        const response = await request(app)
          .get('/api/v1/professional-verifications/me')
          .set('Authorization', authorization(professional));

        expect(response.status).toBe(200);
        expect(response.body.data.verification).toMatchObject({
          userId: professional.id,
          verificationStatus,
          verificationDocument: {
            originalName: 'comprovante.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 512,
          },
        });
        if (verificationStatus === 'rejected') {
          expect(response.body.data.verification.rejectionReason).toBe(
            'Documento insuficiente.',
          );
        }
        expectNoSensitiveData(response.body);
      },
    );

    it('impede atleta e retorna not found para profissional sem perfil', async () => {
      const athlete = await createUser('athlete');
      const professional = await createUser('professional');

      const forbidden = await request(app)
        .get('/api/v1/professional-verifications/me')
        .set('Authorization', authorization(athlete));
      const missing = await request(app)
        .get('/api/v1/professional-verifications/me')
        .set('Authorization', authorization(professional));

      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('GET /api/v1/professional-verifications/:id', () => {
    it('retorna ao admin detalhe e metadados seguros do documento', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const profile = await createProfessionalProfile(professional);

      const response = await request(app)
        .get(`/api/v1/professional-verifications/${profile.id}`)
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body.data.verification).toMatchObject({
        id: profile.id,
        user: {
          id: professional.id,
          name: professional.name,
          email: professional.email,
          role: 'professional',
        },
        verificationDocument: {
          originalName: 'comprovante.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 512,
        },
      });
      expectNoSensitiveData(response.body);
    });

    it('impede nao-admin, valida ObjectId e trata recurso inexistente', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const profile = await createProfessionalProfile(professional);

      const forbidden = await request(app)
        .get(`/api/v1/professional-verifications/${profile.id}`)
        .set('Authorization', authorization(professional));
      const invalid = await request(app)
        .get('/api/v1/professional-verifications/id-invalido')
        .set('Authorization', authorization(admin));
      const missing = await request(app)
        .get(
          `/api/v1/professional-verifications/${new mongoose.Types.ObjectId()}`,
        )
        .set('Authorization', authorization(admin));

      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/professional-verifications/:id/approve', () => {
    it('aprova de forma atomica e rejeita uma segunda decisao', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const profile = await createProfessionalProfile(professional);

      const pendingAccess = await request(app)
        .get('/api/v1/links')
        .set('Authorization', authorization(professional));
      expect(pendingAccess.status).toBe(403);
      expect(pendingAccess.body.error.code).toBe(
        'PROFESSIONAL_PENDING_APPROVAL',
      );

      const responses = await Promise.all([
        request(app)
          .patch(`/api/v1/professional-verifications/${profile.id}/approve`)
          .set('Authorization', authorization(admin))
          .send({}),
        request(app)
          .patch(`/api/v1/professional-verifications/${profile.id}/approve`)
          .set('Authorization', authorization(admin))
          .send({}),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 409,
      ]);
      const success = responses.find((response) => response.status === 200);
      const conflict = responses.find((response) => response.status === 409);
      expect(success.body.data.verification.verificationStatus).toBe(
        'approved',
      );
      expect(success.body.data.verification.reviewedBy).toBe(admin.id);
      expect(success.body.data.verification.reviewedAt).toBeTruthy();
      expect(conflict.body.error.code).toBe('PROFESSIONAL_ALREADY_REVIEWED');
      expectNoSensitiveData(success.body);

      const stored = await ProfessionalProfile.findById(profile.id);
      expect(stored.verificationStatus).toBe('approved');
      expect(stored.reviewedBy.toString()).toBe(admin.id);
      expect(stored.reviewedAt).toBeInstanceOf(Date);
      expect(stored.rejectionReason).toBeNull();

      const approvedAccess = await request(app)
        .get('/api/v1/links')
        .set('Authorization', authorization(professional));
      expect(approvedAccess.status).toBe(200);
    });

    it('impede nao-admin e rejeita payload desconhecido', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const profile = await createProfessionalProfile(professional);

      const forbidden = await request(app)
        .patch(`/api/v1/professional-verifications/${profile.id}/approve`)
        .set('Authorization', authorization(professional))
        .send({});
      const invalid = await request(app)
        .patch(`/api/v1/professional-verifications/${profile.id}/approve`)
        .set('Authorization', authorization(admin))
        .send({ status: 'approved' });

      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/professional-verifications/:id/reject', () => {
    it('rejeita com motivo e impede decisao posterior', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const profile = await createProfessionalProfile(professional);

      const rejected = await request(app)
        .patch(`/api/v1/professional-verifications/${profile.id}/reject`)
        .set('Authorization', authorization(admin))
        .send({ reason: '  Documento invalido ou insuficiente.  ' });
      const repeated = await request(app)
        .patch(`/api/v1/professional-verifications/${profile.id}/approve`)
        .set('Authorization', authorization(admin))
        .send({});

      expect(rejected.status).toBe(200);
      expect(rejected.body.data.verification).toMatchObject({
        verificationStatus: 'rejected',
        reviewedBy: admin.id,
        rejectionReason: 'Documento invalido ou insuficiente.',
      });
      expect(repeated.status).toBe(409);
      expect(repeated.body.error.code).toBe('PROFESSIONAL_ALREADY_REVIEWED');
      expectNoSensitiveData(rejected.body);

      const stored = await ProfessionalProfile.findById(profile.id);
      expect(stored.verificationStatus).toBe('rejected');
      expect(stored.rejectionReason).toBe(
        'Documento invalido ou insuficiente.',
      );

      const rejectedAccess = await request(app)
        .get('/api/v1/links')
        .set('Authorization', authorization(professional));
      expect(rejectedAccess.status).toBe(403);
      expect(rejectedAccess.body.error.code).toBe('PROFESSIONAL_REJECTED');
    });

    it('exige motivo valido e valida a existencia do perfil', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const profile = await createProfessionalProfile(professional);

      const invalid = await request(app)
        .patch(`/api/v1/professional-verifications/${profile.id}/reject`)
        .set('Authorization', authorization(admin))
        .send({ reason: '   ' });
      const missing = await request(app)
        .patch(
          `/api/v1/professional-verifications/${new mongoose.Types.ObjectId()}/reject`,
        )
        .set('Authorization', authorization(admin))
        .send({ reason: 'Documento insuficiente.' });

      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
