module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  passWithNoTests: true,
  collectCoverageFrom: [
    'api/lib/**/*.js',
    '!**/node_modules/**'
    // frontend/stl-parser.js added in Task 3
  ],
  coverageThreshold: {
    './api/lib/pricing.js': { lines: 90 },
    // './frontend/stl-parser.js': { lines: 90 } — added in Task 3
    global: { lines: 70 }
  }
};
