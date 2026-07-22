const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../../src/app');
const AUDIT_ACTIONS = require('../../src/constants/audit-actions');
const AuditLog = require('../../src/models/audit-log');
const User = require('../../src/models/user');
const auditService = require('../../src/services/audit-service');
const { generateToken } = require('../../src/utils/jwt');

const DATES = Object.freeze({
  FIRST: new Date('2026-01-10T10:00:00.000Z'),
  SECOND: new Date('2026-02-10T10:00:00.000Z'),
  THIRD: new Date('2026-03-10T10:00:00.000Z'),
});

async function createUser(role = 'athlete') {
  return User.create({
    name: `Usuário ${role}`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: await bcrypt.hash('SenhaForte123!', 4),
    role,
  });
}

function authorization(user) {
  return `Bearer ${generateToken(user)}`;
}

async function recordAudit(overrides = {}, createdAt) {
  const input = {
    actorId: null,
    action: AUDIT_ACTIONS.USER_BLOCKED,
    entityType: 'User',
    entityId: new mongoose.Types.ObjectId(),
    metadata: { from: false, to: true },
    ...overrides,
  };

  await auditService.record(input);
  const auditLog = await AuditLog.findOne({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
  }).sort({ createdAt: -1 });

  if (createdAt) {
    await AuditLog.collection.updateOne(
      { _id: auditLog._id },
      { $set: { createdAt } },
    );
    auditLog.createdAt = createdAt;
  }

  return auditLog;
}

function idsFrom(response) {
  return response.body.data.map((auditLog) => auditLog.id);
}

describe('consulta administrativa de auditoria', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([AuditLog.init(), User.init()]);
  }, 120000);

  afterEach(async () => {
    await Promise.all([AuditLog.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('GET /api/v1/audit-logs', () => {
    it('permite que admin liste logs recentes primeiro em envelope seguro', async () => {
      const admin = await createUser('admin');
      const actor = await createUser('professional');
      const older = await recordAudit(
        {
          actorId: actor.id,
          action: AUDIT_ACTIONS.PROTOCOL_CREATED,
          entityType: 'Protocol',
          metadata: { status: 'draft', version: 1 },
        },
        DATES.FIRST,
      );
      const newer = await recordAudit(
        {
          actorId: admin.id,
          action: AUDIT_ACTIONS.USER_BLOCKED,
          entityType: 'User',
          metadata: { from: false, to: true },
        },
        DATES.SECOND,
      );

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        meta: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
      expect(idsFrom(response)).toEqual([newer.id, older.id]);
      expect(Object.keys(response.body.data[0]).sort()).toEqual(
        [
          'action',
          'actorId',
          'createdAt',
          'entityId',
          'entityType',
          'id',
          'ipHash',
          'metadata',
        ].sort(),
      );
      expect(response.body.data[0]).toMatchObject({
        actorId: admin.id,
        action: AUDIT_ACTIONS.USER_BLOCKED,
        entityType: 'User',
        entityId: newer.entityId.toString(),
        metadata: { from: false, to: true },
        ipHash: null,
        createdAt: DATES.SECOND.toISOString(),
      });

      const serialized = JSON.stringify(response.body);
      for (const forbidden of [
        'passwordHash',
        'SenhaForte123!',
        'storageKey',
        'authorization',
        'Bearer ',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it.each(['professional', 'athlete'])(
      'impede consulta pelo perfil %s',
      async (role) => {
        const user = await createUser(role);

        const response = await request(app)
          .get('/api/v1/audit-logs')
          .set('Authorization', authorization(user));

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      },
    );

    it('exige autenticação', async () => {
      const response = await request(app).get('/api/v1/audit-logs');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('filtra por ator, entidade, recurso, ação e intervalo de datas', async () => {
      const admin = await createUser('admin');
      const firstActor = await createUser('professional');
      const secondActor = await createUser('admin');
      const firstEntityId = new mongoose.Types.ObjectId();
      const secondEntityId = new mongoose.Types.ObjectId();
      const thirdEntityId = new mongoose.Types.ObjectId();

      const first = await recordAudit(
        {
          actorId: firstActor.id,
          entityId: firstEntityId,
        },
        DATES.FIRST,
      );
      const second = await recordAudit(
        {
          actorId: firstActor.id,
          action: AUDIT_ACTIONS.PROTOCOL_CREATED,
          entityType: 'Protocol',
          entityId: secondEntityId,
          metadata: { status: 'draft', version: 1 },
        },
        DATES.SECOND,
      );
      const third = await recordAudit(
        {
          actorId: secondActor.id,
          action: AUDIT_ACTIONS.USER_UNBLOCKED,
          entityId: thirdEntityId,
          metadata: { from: true, to: false },
        },
        DATES.THIRD,
      );

      const cases = [
        [{ actorId: firstActor.id }, [second.id, first.id]],
        [{ entityType: 'Protocol' }, [second.id]],
        [{ entityId: firstEntityId.toString() }, [first.id]],
        [{ action: AUDIT_ACTIONS.USER_UNBLOCKED }, [third.id]],
        [
          {
            dateFrom: '2026-02-01T00:00:00.000Z',
            dateTo: '2026-02-28T23:59:59.999Z',
          },
          [second.id],
        ],
      ];

      for (const [query, expectedIds] of cases) {
        const response = await request(app)
          .get('/api/v1/audit-logs')
          .query(query)
          .set('Authorization', authorization(admin));

        expect(response.status).toBe(200);
        expect(idsFrom(response)).toEqual(expectedIds);
        expect(response.body.meta.total).toBe(expectedIds.length);
      }
    });

    it('aplica paginação após ordenar pelos registros mais recentes', async () => {
      const admin = await createUser('admin');
      const first = await recordAudit({}, DATES.FIRST);
      const second = await recordAudit(
        { entityId: new mongoose.Types.ObjectId() },
        DATES.SECOND,
      );
      const third = await recordAudit(
        { entityId: new mongoose.Types.ObjectId() },
        DATES.THIRD,
      );

      const response = await request(app)
        .get('/api/v1/audit-logs?page=2&limit=1')
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(200);
      expect(idsFrom(response)).toEqual([second.id]);
      expect(response.body.meta).toEqual({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
      expect(first.id).not.toBe(third.id);
    });

    it.each(['actorId', 'entityId'])(
      'rejeita ObjectId inválido no filtro %s',
      async (filter) => {
        const admin = await createUser('admin');

        const response = await request(app)
          .get('/api/v1/audit-logs')
          .query({ [filter]: 'id-invalido' })
          .set('Authorization', authorization(admin));

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_OBJECT_ID');
      },
    );

    it.each([
      ['campo desconhecido', { unknown: 'true' }],
      ['limit acima do máximo', { limit: 101 }],
      ['ação desconhecida', { action: 'UNKNOWN_AUDIT_ACTION' }],
      ['tipo de entidade desconhecido', { entityType: 'UnknownEntity' }],
      [
        'intervalo de datas invertido',
        {
          dateFrom: '2026-03-01T00:00:00.000Z',
          dateTo: '2026-02-01T00:00:00.000Z',
        },
      ],
    ])('rejeita %s', async (_case, query) => {
      const admin = await createUser('admin');

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .query(query)
        .set('Authorization', authorization(admin));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('ausência de operações públicas de escrita', () => {
    it('não permite criar, alterar ou excluir logs por HTTP', async () => {
      const admin = await createUser('admin');
      const auditLog = await recordAudit({}, DATES.FIRST);
      const original = await AuditLog.findById(auditLog.id).lean();
      const headers = { Authorization: authorization(admin) };

      const created = await request(app)
        .post('/api/v1/audit-logs')
        .set(headers)
        .send({
          actorId: admin.id,
          action: AUDIT_ACTIONS.USER_BLOCKED,
          entityType: 'User',
          entityId: admin.id,
          metadata: {},
        });
      const updated = await request(app)
        .patch(`/api/v1/audit-logs/${auditLog.id}`)
        .set(headers)
        .send({ action: AUDIT_ACTIONS.USER_UNBLOCKED });
      const deleted = await request(app)
        .delete(`/api/v1/audit-logs/${auditLog.id}`)
        .set(headers);

      for (const response of [created, updated, deleted]) {
        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      }

      expect(await AuditLog.countDocuments()).toBe(1);
      const stored = await AuditLog.findById(auditLog.id).lean();
      expect(stored).toEqual(original);
    });
  });
});
