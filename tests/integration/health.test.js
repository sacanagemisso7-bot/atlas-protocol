const request = require('supertest');

const app = require('../../src/app');

describe('GET /api/v1/health', () => {
  it('retorna o status da aplicação', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        timestamp: expect.any(String),
      },
    });
    expect(new Date(response.body.data.timestamp).toISOString()).toBe(
      response.body.data.timestamp,
    );
  });
});
