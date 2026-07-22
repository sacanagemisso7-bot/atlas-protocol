module.exports = {
  clearMocks: true,
  coverageDirectory: 'coverage',
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
};
