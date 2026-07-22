const mongoose = require('mongoose');

const AUDIT_ACTIONS = require('../../src/constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../../src/constants/audit-entity-types');
const AuditLog = require('../../src/models/audit-log');

function validAuditLog(overrides = {}) {
  return {
    actorId: new mongoose.Types.ObjectId(),
    action: AUDIT_ACTIONS.PROFESSIONAL_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL_PROFILE,
    entityId: new mongoose.Types.ObjectId(),
    metadata: { from: 'pending', to: 'approved' },
    ipHash: 'a'.repeat(64),
    ...overrides,
  };
}

describe('AuditLog model', () => {
  it('define a collection e os campos oficiais', () => {
    expect(AuditLog.collection.name).toBe('audit_logs');
    expect(AuditLog.schema.path('actorId').instance).toBe('ObjectId');
    expect(AuditLog.schema.path('action').instance).toBe('String');
    expect(AuditLog.schema.path('entityType').instance).toBe('String');
    expect(AuditLog.schema.path('entityId').instance).toBe('ObjectId');
    expect(AuditLog.schema.path('metadata').instance).toBe('Mixed');
    expect(AuditLog.schema.path('ipHash').instance).toBe('String');
    expect(AuditLog.schema.path('createdAt').instance).toBe('Date');
  });

  it('aplica valores padrão e cria createdAt sem updatedAt', () => {
    const beforeCreation = Date.now();
    const auditLog = new AuditLog({
      action: AUDIT_ACTIONS.PROFESSIONAL_REGISTERED,
      entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL_PROFILE,
    });

    expect(auditLog.actorId).toBeNull();
    expect(auditLog.entityId).toBeNull();
    expect(auditLog.metadata).toEqual({});
    expect(auditLog.ipHash).toBeNull();
    expect(auditLog.createdAt).toBeInstanceOf(Date);
    expect(auditLog.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation);
    expect(auditLog.updatedAt).toBeUndefined();
  });

  it('exige action e entityType', async () => {
    const auditLog = new AuditLog({});

    await expect(auditLog.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        action: expect.any(Object),
        entityType: expect.any(Object),
      }),
    });
  });

  it('define os índices oficiais de consulta', () => {
    expect(AuditLog.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { entityType: 1, entityId: 1, createdAt: -1 },
          expect.any(Object),
        ],
        [{ actorId: 1, createdAt: -1 }, expect.any(Object)],
        [{ action: 1, createdAt: -1 }, expect.any(Object)],
      ]),
    );
  });

  it('não permite alterar campos de um documento persistido', () => {
    const original = {
      _id: new mongoose.Types.ObjectId(),
      ...validAuditLog(),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const auditLog = AuditLog.hydrate(original);

    auditLog.actorId = new mongoose.Types.ObjectId();
    auditLog.action = AUDIT_ACTIONS.PROFESSIONAL_REJECTED;
    auditLog.entityType = AUDIT_ENTITY_TYPES.USER;
    auditLog.entityId = new mongoose.Types.ObjectId();
    auditLog.metadata = { changed: true };
    auditLog.ipHash = 'b'.repeat(64);
    auditLog.createdAt = new Date('2027-01-01T00:00:00.000Z');

    expect(auditLog.actorId).toEqual(original.actorId);
    expect(auditLog.action).toBe(original.action);
    expect(auditLog.entityType).toBe(original.entityType);
    expect(auditLog.entityId).toEqual(original.entityId);
    expect(auditLog.metadata).toEqual(original.metadata);
    expect(auditLog.ipHash).toBe(original.ipHash);
    expect(auditLog.createdAt).toEqual(original.createdAt);
    expect(auditLog.modifiedPaths()).toEqual([]);
  });
});
