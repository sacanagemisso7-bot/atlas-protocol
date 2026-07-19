const allowRoles = require('../../src/middlewares/role-middleware');

describe('roleMiddleware', () => {
  it('permite um perfil autorizado', () => {
    const middleware = allowRoles('admin');
    const next = jest.fn();

    middleware({ user: { role: 'admin' } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('retorna FORBIDDEN para um perfil sem permissão', () => {
    const middleware = allowRoles('admin');
    const next = jest.fn();

    middleware({ user: { role: 'athlete' } }, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      }),
    );
  });
});
