export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: ['**/src/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
