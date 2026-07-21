const User = require('../../src/models/user');

describe('User model', () => {
  it('protege passwordHash por padrão e define os índices esperados', () => {
    expect(User.schema.path('passwordHash').options.select).toBe(false);
    expect(User.schema.path('active').options.default).toBe(true);
    expect(User.schema.path('role').options.enum).toEqual(
      expect.arrayContaining(['admin', 'professional', 'athlete']),
    );

    const indexes = User.schema.indexes();
    expect(indexes).toContainEqual([
      { email: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexes).toContainEqual([
      { role: 1, active: 1 },
      expect.any(Object),
    ]);
  });

  it('remove passwordHash ao serializar', () => {
    const user = new User({
      name: 'Atleta Teste',
      email: 'atleta@example.com',
      passwordHash: 'hash-secreto',
      role: 'athlete',
    });

    const serialized = user.toJSON();

    expect(serialized).not.toHaveProperty('passwordHash');
    expect(serialized).not.toHaveProperty('_id');
    expect(serialized.id).toBe(user.id);
  });
});
