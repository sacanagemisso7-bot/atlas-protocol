const { generateToken, verifyToken } = require('../../src/utils/jwt');

describe('JWT', () => {
  it('inclui somente identificador, perfil e claims técnicos necessários', () => {
    const token = generateToken({ id: '507f1f77bcf86cd799439011', role: 'athlete' });
    const payload = verifyToken(token);

    expect(payload.sub).toBe('507f1f77bcf86cd799439011');
    expect(payload.role).toBe('athlete');
    expect(Object.keys(payload).sort()).toEqual(
      ['exp', 'iat', 'role', 'sub'].sort(),
    );
  });
});
