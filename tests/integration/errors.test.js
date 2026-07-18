const express = require('express');
const request = require('supertest');

const app = require('../../src/app');
const errorHandler = require('../../src/middlewares/error-handler');

describe('tratamento de erros', () => {
  it('retorna uma rota inexistente no padrão da API', async () => {
    const response = await request(app).get('/api/v1/inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Recurso não encontrado.',
        fields: [],
      },
    });
  });

  it('retorna um erro interno no padrão da API', async () => {
    const testApp = express();
    testApp.get('/erro', () => {
      throw new Error('detalhe interno');
    });
    testApp.use(errorHandler);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const response = await request(testApp).get('/erro');
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno no servidor.',
        fields: [],
      },
    });
  });
});
