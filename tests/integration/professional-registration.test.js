const crypto = require('crypto');

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const AUDIT_ACTIONS = require('../../src/constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../../src/constants/audit-entity-types');
const AuditLog = require('../../src/models/audit-log');
const ProfessionalProfile = require('../../src/models/professional-profile');
const User = require('../../src/models/user');
const auditService = require('../../src/services/audit-service');
const storage = require('../../src/storage');
const { verifyToken } = require('../../src/utils/jwt');

const validRegistration = {
  name: 'Profissional Teste',
  email: 'profissional@example.com',
  password: 'SenhaForte123!',
};
const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');

function professionalRegistrationRequest(overrides = {}) {
  const fields = { ...validRegistration, ...overrides };
  let registrationRequest = request(app).post(
    '/api/v1/auth/register-professional',
  );

  for (const [field, value] of Object.entries(fields)) {
    registrationRequest = registrationRequest.field(field, value);
  }

  return registrationRequest;
}

async function createProfessional(verificationStatus = 'pending') {
  const passwordHash = await bcrypt.hash(validRegistration.password, 10);
  const user = await User.create({
    name: validRegistration.name,
    email: validRegistration.email,
    passwordHash,
    role: 'professional',
  });
  const reviewed = verificationStatus !== 'pending';
  const profile = await ProfessionalProfile.create({
    userId: user.id,
    verificationStatus,
    verificationDocument: {
      storageKey: `${crypto.randomUUID()}.pdf`,
      url: `/private-files/${crypto.randomUUID()}.pdf`,
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: validPdf.length,
    },
    reviewedAt: reviewed ? new Date() : null,
    reviewedBy: reviewed ? user.id : null,
    rejectionReason:
      verificationStatus === 'rejected' ? 'Documento insuficiente.' : null,
  });

  return { profile, user };
}

describe('cadastro e sessão de profissional', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 120000);

  afterEach(async () => {
    const profiles = await ProfessionalProfile.find({}).select(
      '+verificationDocument.storageKey',
    );

    await Promise.allSettled(
      profiles
        .map((profile) => profile.verificationDocument?.storageKey)
        .filter(Boolean)
        .map((storageKey) => storage.remove(storageKey)),
    );
    await AuditLog.deleteMany({});
    await ProfessionalProfile.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/auth/register-professional', () => {
    it('cria usuário e perfil pending com PDF, hash e resposta segura', async () => {
      const response = await professionalRegistrationRequest({
        email: ' PROFISSIONAL@EXAMPLE.COM ',
      }).attach('document', validPdf, {
        filename: 'comprovante.pdf',
        contentType: 'application/pdf',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            name: validRegistration.name,
            email: validRegistration.email,
            role: 'professional',
            active: true,
          },
          verification: { status: 'pending' },
          token: expect.any(String),
        },
        message: 'Cadastro enviado para análise.',
      });
      expect(response.body.data.verification.submittedAt).toEqual(
        expect.any(String),
      );
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
      expect(response.body.data).not.toHaveProperty('verificationDocument');
      expect(JSON.stringify(response.body)).not.toContain('storageKey');
      expect(JSON.stringify(response.body)).not.toContain('/private-files/');

      const user = await User.findOne({
        email: validRegistration.email,
      }).select('+passwordHash');
      const profile = await ProfessionalProfile.findOne({
        userId: user.id,
      }).select(
        '+verificationDocument.storageKey +verificationDocument.url',
      );

      expect(user.role).toBe('professional');
      await expect(
        bcrypt.compare(validRegistration.password, user.passwordHash),
      ).resolves.toBe(true);
      expect(profile).toMatchObject({
        verificationStatus: 'pending',
        verificationDocument: {
          originalName: 'comprovante.pdf',
          mimeType: 'application/pdf',
          sizeBytes: validPdf.length,
        },
      });
      expect(profile.verificationDocument.storageKey).not.toBe(
        'comprovante.pdf',
      );

      const auditLog = await AuditLog.findOne({
        action: AUDIT_ACTIONS.PROFESSIONAL_REGISTERED,
      });
      expect(auditLog).toMatchObject({
        actorId: user._id,
        action: AUDIT_ACTIONS.PROFESSIONAL_REGISTERED,
        entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL_PROFILE,
        entityId: profile._id,
        metadata: { verificationStatus: 'pending' },
      });
      expect(JSON.stringify(auditLog)).not.toMatch(
        /password|token|jwt|buffer|storageKey|verificationDocument/i,
      );

      const tokenPayload = verifyToken(response.body.data.token);
      expect(tokenPayload).toMatchObject({
        sub: user.id,
        role: 'professional',
      });
      expect(tokenPayload).not.toHaveProperty('verificationStatus');
    });

    it('rejeita cadastro sem PDF', async () => {
      const response = await professionalRegistrationRequest();

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(
        'PROFESSIONAL_VERIFICATION_REQUIRED',
      );
      expect(await User.countDocuments()).toBe(0);
      expect(await ProfessionalProfile.countDocuments()).toBe(0);
    });

    it('rejeita arquivo que não é PDF', async () => {
      const response = await professionalRegistrationRequest().attach(
        'document',
        Buffer.from('arquivo de texto'),
        { filename: 'documento.txt', contentType: 'text/plain' },
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_UPLOAD_TYPE');
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejeita MIME incompatível mesmo com extensão PDF', async () => {
      const response = await professionalRegistrationRequest().attach(
        'document',
        validPdf,
        { filename: 'documento.pdf', contentType: 'text/plain' },
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_UPLOAD_TYPE');
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejeita conteúdo sem assinatura PDF mesmo com MIME e extensão válidos', async () => {
      const response = await professionalRegistrationRequest().attach(
        'document',
        Buffer.from('conteúdo que não é PDF'),
        { filename: 'documento.pdf', contentType: 'application/pdf' },
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_UPLOAD_TYPE');
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejeita arquivo acima do limite configurado', async () => {
      const oversizedPdf = Buffer.concat([
        Buffer.from('%PDF-'),
        Buffer.alloc(1020),
      ]);
      const response = await professionalRegistrationRequest().attach(
        'document',
        oversizedPdf,
        { filename: 'documento.pdf', contentType: 'application/pdf' },
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UPLOAD_TOO_LARGE');
      expect(await User.countDocuments()).toBe(0);
    });

    it('retorna EMAIL_ALREADY_EXISTS sem criar perfil para e-mail duplicado', async () => {
      const passwordHash = await bcrypt.hash(validRegistration.password, 10);
      await User.create({
        ...validRegistration,
        passwordHash,
        role: 'athlete',
      });

      const response = await professionalRegistrationRequest({
        email: 'PROFISSIONAL@EXAMPLE.COM',
      }).attach('document', validPdf, {
        filename: 'comprovante.pdf',
        contentType: 'application/pdf',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(await User.countDocuments()).toBe(1);
      expect(await ProfessionalProfile.countDocuments()).toBe(0);
    });

    it('compensa User e arquivo quando a criação do perfil falha', async () => {
      const profileCreate = jest
        .spyOn(ProfessionalProfile, 'create')
        .mockRejectedValueOnce(new Error('Falha simulada ao criar perfil.'));
      const storageRemove = jest.spyOn(storage, 'remove');
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        const response = await professionalRegistrationRequest().attach(
          'document',
          validPdf,
          { filename: 'comprovante.pdf', contentType: 'application/pdf' },
        );

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
        expect(await User.countDocuments()).toBe(0);
        expect(await ProfessionalProfile.countDocuments()).toBe(0);
        expect(storageRemove).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/));
      } finally {
        profileCreate.mockRestore();
        storageRemove.mockRestore();
        consoleError.mockRestore();
      }
    });

    it('compensa cadastro e arquivo quando a auditoria falha', async () => {
      const auditRecord = jest
        .spyOn(auditService, 'record')
        .mockRejectedValueOnce(new Error('Falha simulada na auditoria.'));
      const storageRemove = jest.spyOn(storage, 'remove');
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        const response = await professionalRegistrationRequest().attach(
          'document',
          validPdf,
          { filename: 'comprovante.pdf', contentType: 'application/pdf' },
        );

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
        expect(await User.countDocuments()).toBe(0);
        expect(await ProfessionalProfile.countDocuments()).toBe(0);
        expect(await AuditLog.countDocuments()).toBe(0);
        expect(storageRemove).toHaveBeenCalledWith(
          expect.stringMatching(/\.pdf$/),
        );
      } finally {
        auditRecord.mockRestore();
        storageRemove.mockRestore();
        consoleError.mockRestore();
      }
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it.each(['pending', 'approved', 'rejected'])(
      'permite login de profissional %s e retorna seu status',
      async (verificationStatus) => {
        const { user } = await createProfessional(verificationStatus);

        const response = await request(app).post('/api/v1/auth/login').send({
          email: validRegistration.email,
          password: validRegistration.password,
        });

        expect(response.status).toBe(200);
        expect(response.body.data.token).toEqual(expect.any(String));
        expect(response.body.data.user).toMatchObject({
          id: user.id,
          role: 'professional',
          verificationStatus,
        });
        expect(response.body.data.user).not.toHaveProperty('passwordHash');
        expect(response.body.data.user).not.toHaveProperty(
          'verificationDocument',
        );
        expect(response.body.data.user).not.toHaveProperty('rejectionReason');

        const updatedUser = await User.findById(user.id);
        expect(updatedUser.lastLoginAt).toBeInstanceOf(Date);
      },
    );

    it('rejeita profissional sem ProfessionalProfile', async () => {
      const passwordHash = await bcrypt.hash(validRegistration.password, 10);
      const user = await User.create({
        ...validRegistration,
        passwordHash,
        role: 'professional',
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: validRegistration.email,
        password: validRegistration.password,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(
        'PROFESSIONAL_VERIFICATION_REQUIRED',
      );
      expect((await User.findById(user.id)).lastLoginAt).toBeNull();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it.each([
      ['pending', undefined],
      ['rejected', 'Documento insuficiente.'],
    ])(
      'retorna situação própria %s sem dados do documento',
      async (verificationStatus, rejectionReason) => {
        await createProfessional(verificationStatus);
        const login = await request(app).post('/api/v1/auth/login').send({
          email: validRegistration.email,
          password: validRegistration.password,
        });

        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${login.body.data.token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.user.verificationStatus).toBe(
          verificationStatus,
        );
        expect(response.body.data.user.rejectionReason).toBe(rejectionReason);
        expect(response.body.data.user).not.toHaveProperty(
          'verificationDocument',
        );
        expect(response.body.data.user).not.toHaveProperty('passwordHash');
      },
    );
  });
});
