import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('puppeteer');
jest.mock('lighthouse');
jest.mock('cheerio');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.MAX_URLS_PER_REQUEST = '5';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test setup
beforeAll(() => {
  // Suppress console logs during tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Cleanup after all tests
  jest.clearAllMocks();
});