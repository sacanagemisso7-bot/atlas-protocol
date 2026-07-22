const mongoose = require('mongoose');

jest.mock('../../src/models/audit-log', () => ({
  create: jest.fn(),
}));

const AUDIT_ACTIONS = require('../../src/constants/audit-actions');
const AUDIT_ENTITY_TYPES = require('../../src/constants/audit-entity-types');
const AuditLog = require('../../src/models/audit-log');
const auditService = require('../../src/services/audit-service');

function validAuditEvent(overrides = {}) {
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

describe('AuditService.record', () => {
  it('persiste e retorna um evento válido', async () => {
    const event = validAuditEvent();
    const createdAuditLog = { id: new mongoose.Types.ObjectId().toString() };
    AuditLog.create.mockResolvedValue(createdAuditLog);

    await expect(auditService.record(event)).resolves.toBe(createdAuditLog);
    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    expect(AuditLog.create).toHaveBeenCalledWith(event);
  });

  it('sanitiza espaços em strings da metadata sem alterar a entrada', async () => {
    const event = validAuditEvent({
      metadata: {
        status: '  pending  ',
        nested: { note: '  revisão administrativa  ' },
      },
    });
    AuditLog.create.mockImplementation(async (payload) => payload);

    const result = await auditService.record(event);

    expect(result.metadata).toEqual({
      status: 'pending',
      nested: { note: 'revisão administrativa' },
    });
    expect(event.metadata).toEqual({
      status: '  pending  ',
      nested: { note: '  revisão administrativa  ' },
    });
  });

  it.each([
    ['passwordHash', { passwordHash: 'hash' }],
    ['token', { nested: { token: 'jwt' } }],
    ['storageKey', { document: { storageKey: 'private/file.pdf' } }],
    ['buffer', { buffer: Buffer.from('PDF') }],
  ])('recusa a chave sensível %s em metadata', async (_key, metadata) => {
    await expect(
      auditService.record(validAuditEvent({ metadata })),
    ).rejects.toThrow();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      'profundidade excessiva',
      { level1: { level2: { level3: { level4: { level5: 'fim' } } } } },
    ],
    ['string excessiva', { note: 'x'.repeat(100000) }],
    ['array excessivo', { values: Array.from({ length: 1000 }, () => 'x') }],
    [
      'quantidade excessiva de campos',
      Object.fromEntries(
        Array.from({ length: 1000 }, (_value, index) => [
          `field${index}`,
          index,
        ]),
      ),
    ],
  ])('recusa metadata com %s', async (_case, metadata) => {
    await expect(
      auditService.record(validAuditEvent({ metadata })),
    ).rejects.toThrow();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it('recusa ação fora da lista permitida', async () => {
    await expect(
      auditService.record(
        validAuditEvent({ action: 'UNKNOWN_AUDIT_ACTION' }),
      ),
    ).rejects.toThrow();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it('recusa tipo de entidade fora da lista permitida', async () => {
    await expect(
      auditService.record(validAuditEvent({ entityType: 'UnknownEntity' })),
    ).rejects.toThrow();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});
