module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  passWithNoTests: true,
  collectCoverageFrom: [
    'api/lib/**/*.js',
    'frontend/stl-parser.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    './api/lib/pricing.js': { lines: 90 },
    './frontend/stl-parser.js': { lines: 90 },
    global: { lines: 70 }
  }
};
