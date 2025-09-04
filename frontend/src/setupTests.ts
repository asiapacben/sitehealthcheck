// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock window.URL.createObjectURL for file download tests
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mocked-url'),
    revokeObjectURL: jest.fn(),
  },
});

// Mock URL constructor for JSDOM environment
const OriginalURL = global.URL;
global.URL = class URL {
  constructor(url: string, base?: string) {
    try {
      const urlObj = new OriginalURL(url, base || 'http://localhost');
      this.href = urlObj.href;
      this.pathname = urlObj.pathname;
    } catch (e) {
      this.href = url;
      this.pathname = url.replace(/^https?:\/\/[^\/]+/, '') || '/';
    }
  }
  href: string;
  pathname: string;
};

// Mock console methods to reduce noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock IntersectionObserver for components that might use it
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver for components that might use it
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};