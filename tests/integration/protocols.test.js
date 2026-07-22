const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const AUDIT_ACTIONS = require('../../src/constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../../src/constants/audit-entity-types');
const AuditLog = require('../../src/models/audit-log');
const ProfessionalAthleteLink = require('../../src/models/professional-athlete-link');
const ProfessionalProfile = require('../../src/models/professional-profile');
const Protocol = require('../../src/models/protocol');
const ProtocolVersion = require('../../src/models/protocol-version');
const Substance = require('../../src/models/substance');
const User = require('../../src/models/user');
const { generateToken } = require('../../src/utils/jwt');

async function createUser(role) {
  const user = await User.create({
    name: `Usuário ${role}`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: await bcrypt.hash('SenhaForte123!', 10),
    role,
  });

  if (role === 'professional') {
    await ProfessionalProfile.create({
      userId: user.id,
      verificationStatus: 'approved',
      verificationDocument: {
        storageKey: `${user.id}.pdf`,
        url: `/private-files/${user.id}.pdf`,
        originalName: 'documento.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20,
      },
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: user.id,
    });
  }

  return user;
}

async function createSubstance(admin, overrides = {}) {
  return Substance.create({
    name: `Substância ${new mongoose.Types.ObjectId()}`,
    category: 'supplement',
    defaultUnit: 'g',
    active: true,
    createdBy: admin.id,
    ...overrides,
  });
}

async function createActiveLink(professional, athlete) {
  return ProfessionalAthleteLink.create({
    professionalId: professional.id,
    athleteId: athlete.id,
    status: 'active',
    startedAt: new Date(),
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

function protocolPayload(athlete, substance, overrides = {}) {
  return {
    athleteId: athlete.id,
    title: 'Protocolo de acompanhamento',
    objective: 'Organização do acompanhamento.',
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-10-01T00:00:00.000Z',
    continuous: false,
    items: [
      {
        substanceId: substance.id,
        instructions: 'Informação registrada pelo profissional.',
        frequencyType: 'weekly',
        weekDays: [1, 4],
        time: '08:00',
        dosage: 'Informado pelo profissional',
        unit: 'g',
        frequency: 'Sem cálculo automático',
        schedule: 'Segunda e quinta',
        notes: 'Registro operacional.',
      },
    ],
    ...overrides,
  };
}

async function createProtocolThroughApi(professional, athlete, substance, overrides) {
  return request(app)
    .post('/api/v1/protocols')
    .set('Authorization', authorization(professional))
    .send(protocolPayload(athlete, substance, overrides));
}

describe('protocolos e versionamento', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([ProtocolVersion.init(), Substance.init()]);
  }, 120000);

  afterEach(async () => {
    await Promise.all([
      AuditLog.deleteMany({}),
      ProtocolVersion.deleteMany({}),
      Protocol.deleteMany({}),
      ProfessionalAthleteLink.deleteMany({}),
      ProfessionalProfile.deleteMany({}),
      Substance.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/protocols', () => {
    it('cria draft e versão inicial com snapshots e IDs autenticados', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin, { name: 'Creatina' });
      await createActiveLink(professional, athlete);

      const response = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );

      expect(response.status).toBe(201);
      expect(response.body.data.protocol).toMatchObject({
        athleteId: athlete.id,
        professionalId: professional.id,
        status: 'draft',
        currentVersion: 1,
      });
      expect(response.body.data.currentVersion).toMatchObject({
        version: 1,
        createdBy: professional.id,
      });
      expect(response.body.data.currentVersion.items[0]).toMatchObject({
        substanceId: substance.id,
        substanceSnapshot: { name: 'Creatina', category: 'supplement' },
        dosage: 'Informado pelo profissional',
      });
      expect(await Protocol.countDocuments()).toBe(1);
      expect(await ProtocolVersion.countDocuments()).toBe(1);

      const protocol = await Protocol.findOne({});
      const auditLog = await AuditLog.findOne({
        action: AUDIT_ACTIONS.PROTOCOL_CREATED,
      });
      expect(auditLog).toMatchObject({
        actorId: professional._id,
        entityType: AUDIT_ENTITY_TYPES.PROTOCOL,
        entityId: protocol._id,
        metadata: { status: 'draft', version: 1 },
      });
      expect(JSON.stringify(auditLog.metadata)).not.toMatch(
        /items|instructions|dosage|notes/i,
      );
    });

    it('impede criação sem vínculo ativo', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);

      const response = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it.each(['admin', 'athlete'])(
      'impede criação pelo perfil %s',
      async (role) => {
        const admin = await createUser('admin');
        const requester = role === 'admin' ? admin : await createUser(role);
        const athlete = await createUser('athlete');
        const substance = await createSubstance(admin);

        const response = await createProtocolThroughApi(
          requester,
          athlete,
          substance,
        );

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      },
    );

    it('rejeita atleta inexistente ou com perfil incompatível', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const substance = await createSubstance(admin);
      const missing = { id: new mongoose.Types.ObjectId().toString() };

      const missingResponse = await createProtocolThroughApi(
        professional,
        missing,
        substance,
      );
      await createActiveLink(professional, admin);
      const wrongRoleResponse = await createProtocolThroughApi(
        professional,
        admin,
        substance,
      );

      expect(missingResponse.status).toBe(404);
      expect(missingResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(wrongRoleResponse.status).toBe(400);
      expect(wrongRoleResponse.body.error.code).toBe('VALIDATION_ERROR');
    });

    it.each([
      ['inexistente', 'missing'],
      ['inativa', 'inactive'],
    ])('rejeita substância %s', async (_case, kind) => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      await createActiveLink(professional, athlete);
      const substance =
        kind === 'missing'
          ? { id: new mongoose.Types.ObjectId().toString() }
          : await createSubstance(admin, { active: false });

      const response = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );

      expect(response.status).toBe(kind === 'missing' ? 404 : 400);
      expect(response.body.error.code).toBe(
        kind === 'missing' ? 'RESOURCE_NOT_FOUND' : 'VALIDATION_ERROR',
      );
    });

    it('rejeita professionalId externo, ObjectId inválido e datas inconsistentes', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);

      const injected = await request(app)
        .post('/api/v1/protocols')
        .set('Authorization', authorization(professional))
        .send({
          ...protocolPayload(athlete, substance),
          professionalId: professional.id,
        });
      const invalidId = await request(app)
        .post('/api/v1/protocols')
        .set('Authorization', authorization(professional))
        .send({ ...protocolPayload(athlete, substance), athleteId: 'inválido' });
      const invalidDates = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
        {
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
        },
      );

      expect(injected.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
      expect(invalidDates.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('consulta e listagem', () => {
    it('restringe listagem por perfil e impede filtros de ampliar escopo', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      const otherAthlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      await createActiveLink(otherProfessional, otherAthlete);
      await createProtocolThroughApi(professional, athlete, substance);
      await createProtocolThroughApi(otherProfessional, otherAthlete, substance);

      const professionalList = await request(app)
        .get(`/api/v1/protocols?professionalId=${otherProfessional.id}`)
        .set('Authorization', authorization(professional));
      const athleteList = await request(app)
        .get(`/api/v1/protocols?athleteId=${otherAthlete.id}`)
        .set('Authorization', authorization(athlete));
      const adminList = await request(app)
        .get('/api/v1/protocols?page=1&limit=1')
        .set('Authorization', authorization(admin));

      expect(professionalList.body.data).toHaveLength(1);
      expect(professionalList.body.data[0].professionalId).toBe(professional.id);
      expect(athleteList.body.data).toHaveLength(1);
      expect(athleteList.body.data[0].athleteId).toBe(athlete.id);
      expect(adminList.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('filtra por status, substância, datas e ordena', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      const otherSubstance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      await createProtocolThroughApi(professional, athlete, substance);
      await createProtocolThroughApi(professional, athlete, otherSubstance, {
        title: 'Outro protocolo',
        startDate: '2027-01-01T00:00:00.000Z',
        endDate: '2027-02-01T00:00:00.000Z',
      });

      const response = await request(app)
        .get(
          `/api/v1/protocols?status=draft&substanceId=${substance.id}&dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-12-31T23:59:59.999Z&sortBy=startDate&sortOrder=asc`,
        )
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].startDate).toBe('2026-08-01T00:00:00.000Z');
    });

    it.each(['admin', 'professional', 'athlete'])(
      'permite consulta individual ao perfil relacionado %s',
      async (role) => {
        const admin = await createUser('admin');
        const professional = await createUser('professional');
        const athlete = await createUser('athlete');
        const substance = await createSubstance(admin);
        await createActiveLink(professional, athlete);
        const created = await createProtocolThroughApi(
          professional,
          athlete,
          substance,
        );
        const requester = { admin, professional, athlete }[role];

        const response = await request(app)
          .get(`/api/v1/protocols/${created.body.data.protocol.id}`)
          .set('Authorization', authorization(requester));

        expect(response.status).toBe(200);
        expect(response.body.data.currentVersion.version).toBe(1);
      },
    );

    it('oculta protocolo de usuário externo e valida identificador', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const outsider = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );

      const hidden = await request(app)
        .get(`/api/v1/protocols/${created.body.data.protocol.id}`)
        .set('Authorization', authorization(outsider));
      const invalid = await request(app)
        .get('/api/v1/protocols/id-invalido')
        .set('Authorization', authorization(admin));

      expect(hidden.status).toBe(404);
      expect(hidden.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(invalid.body.error.code).toBe('INVALID_OBJECT_ID');
    });
  });

  describe('edição e versionamento', () => {
    it('edita draft atualizando somente a versão inicial', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );
      const protocolId = created.body.data.protocol.id;

      const response = await request(app)
        .patch(`/api/v1/protocols/${protocolId}`)
        .set('Authorization', authorization(professional))
        .send({ title: 'Rascunho atualizado' });

      expect(response.status).toBe(200);
      expect(response.body.data.protocol.currentVersion).toBe(1);
      expect(response.body.data.currentVersion.title).toBe('Rascunho atualizado');
      expect(await ProtocolVersion.countDocuments({ protocolId })).toBe(1);
    });

    it('cria versões sequenciais em active/paused sem alterar snapshots antigos', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin, { name: 'Creatina' });
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );
      const protocolId = created.body.data.protocol.id;
      await request(app)
        .patch(`/api/v1/protocols/${protocolId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});

      const versionTwo = await request(app)
        .patch(`/api/v1/protocols/${protocolId}`)
        .set('Authorization', authorization(professional))
        .send({ title: 'Versão ativa', changeReason: 'Ajuste documentado.' });
      await request(app)
        .patch(`/api/v1/protocols/${protocolId}/pause`)
        .set('Authorization', authorization(professional))
        .send({ reason: 'Pausa operacional.' });
      const versionThree = await request(app)
        .patch(`/api/v1/protocols/${protocolId}`)
        .set('Authorization', authorization(professional))
        .send({ objective: 'Objetivo revisado', changeReason: 'Nova revisão.' });

      expect(versionTwo.body.data.currentVersion.version).toBe(2);
      expect(versionThree.body.data.currentVersion.version).toBe(3);
      const versions = await ProtocolVersion.find({ protocolId }).sort({ version: 1 });
      expect(versions).toHaveLength(3);
      expect(versions[0].title).toBe('Protocolo de acompanhamento');
      expect(versions[0].items[0].substanceSnapshot.name).toBe('Creatina');
      expect(versions[1].title).toBe('Versão ativa');
      expect(versions[2].objective).toBe('Objetivo revisado');

      const versionAuditLogs = await AuditLog.find({
        action: AUDIT_ACTIONS.PROTOCOL_VERSION_CREATED,
      }).sort({ createdAt: 1, _id: 1 });
      expect(versionAuditLogs).toHaveLength(2);
      expect(versionAuditLogs.map((auditLog) => auditLog.metadata)).toEqual([
        { previousVersion: 1, newVersion: 2 },
        { previousVersion: 2, newVersion: 3 },
      ]);
      expect(JSON.stringify(versionAuditLogs)).not.toMatch(
        /items|instructions|dosage|notes/i,
      );
    });

    it('impede alteração por atleta, admin, terceiro e após encerramento', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const otherProfessional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );
      const protocolId = created.body.data.protocol.id;

      for (const requester of [athlete, admin, otherProfessional]) {
        const response = await request(app)
          .patch(`/api/v1/protocols/${protocolId}`)
          .set('Authorization', authorization(requester))
          .send({ title: 'Tentativa indevida' });
        expect([403, 404]).toContain(response.status);
      }

      await request(app)
        .patch(`/api/v1/protocols/${protocolId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});
      await request(app)
        .patch(`/api/v1/protocols/${protocolId}/close`)
        .set('Authorization', authorization(professional))
        .send({ reason: 'Encerramento.' });
      const readOnly = await request(app)
        .patch(`/api/v1/protocols/${protocolId}`)
        .set('Authorization', authorization(professional))
        .send({ title: 'Não permitido' });

      expect(readOnly.status).toBe(422);
      expect(readOnly.body.error.code).toBe('PROTOCOL_READ_ONLY');
    });
  });

  describe('transições e versões históricas', () => {
    it('não ativa protocolo vazio', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
        { items: [] },
      );

      const response = await request(app)
        .patch(`/api/v1/protocols/${created.body.data.protocol.id}/activate`)
        .set('Authorization', authorization(professional))
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PROTOCOL_EMPTY');
    });

    it('permite draft→active→paused→active→closed sem criar versões por status', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );
      const protocolId = created.body.data.protocol.id;

      const active = await request(app)
        .patch(`/api/v1/protocols/${protocolId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});
      const paused = await request(app)
        .patch(`/api/v1/protocols/${protocolId}/pause`)
        .set('Authorization', authorization(professional))
        .send({ reason: 'Pausa.' });
      const resumed = await request(app)
        .patch(`/api/v1/protocols/${protocolId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});
      const closed = await request(app)
        .patch(`/api/v1/protocols/${protocolId}/close`)
        .set('Authorization', authorization(professional))
        .send({ reason: 'Encerramento.' });

      expect(active.body.data.protocol.status).toBe('active');
      expect(paused.body.data.protocol.status).toBe('paused');
      expect(resumed.body.data.protocol.status).toBe('active');
      expect(closed.body.data.protocol.status).toBe('closed');
      expect(await ProtocolVersion.countDocuments({ protocolId })).toBe(1);

      const statusAuditLogs = await AuditLog.find({
        action: AUDIT_ACTIONS.PROTOCOL_STATUS_CHANGED,
      }).sort({ createdAt: 1, _id: 1 });
      expect(statusAuditLogs.map((auditLog) => auditLog.metadata)).toEqual([
        { from: 'draft', to: 'active' },
        { from: 'active', to: 'paused' },
        { from: 'paused', to: 'active' },
        { from: 'active', to: 'closed' },
      ]);
    });

    it('cancela somente draft e rejeita transições inválidas', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const draft = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );
      const cancelled = await request(app)
        .patch(`/api/v1/protocols/${draft.body.data.protocol.id}/cancel`)
        .set('Authorization', authorization(professional))
        .send({});

      const activeProtocol = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
        { title: 'Segundo protocolo' },
      );
      const activeId = activeProtocol.body.data.protocol.id;
      await request(app)
        .patch(`/api/v1/protocols/${activeId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});
      const invalidCancel = await request(app)
        .patch(`/api/v1/protocols/${activeId}/cancel`)
        .set('Authorization', authorization(professional))
        .send({});
      const invalidActivate = await request(app)
        .patch(`/api/v1/protocols/${activeId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});

      expect(cancelled.body.data.protocol.status).toBe('cancelled');
      expect(invalidCancel.body.error.code).toBe('INVALID_STATE_TRANSITION');
      expect(invalidActivate.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('lista versões e retorna snapshot histórico específico', async () => {
      const admin = await createUser('admin');
      const professional = await createUser('professional');
      const athlete = await createUser('athlete');
      const substance = await createSubstance(admin);
      await createActiveLink(professional, athlete);
      const created = await createProtocolThroughApi(
        professional,
        athlete,
        substance,
      );
      const protocolId = created.body.data.protocol.id;
      await request(app)
        .patch(`/api/v1/protocols/${protocolId}/activate`)
        .set('Authorization', authorization(professional))
        .send({});
      await request(app)
        .patch(`/api/v1/protocols/${protocolId}`)
        .set('Authorization', authorization(professional))
        .send({ title: 'Título atual', changeReason: 'Revisão.' });

      const list = await request(app)
        .get(`/api/v1/protocols/${protocolId}/versions`)
        .set('Authorization', authorization(athlete));
      const historical = await request(app)
        .get(`/api/v1/protocols/${protocolId}/versions/1`)
        .set('Authorization', authorization(admin));

      expect(list.body.data.map((version) => version.version)).toEqual([1, 2]);
      expect(historical.body.data.version.title).toBe(
        'Protocolo de acompanhamento',
      );
      expect(historical.body.data.version.title).not.toBe('Título atual');
    });
  });
});
