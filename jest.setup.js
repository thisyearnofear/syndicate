/**
 * Jest Setup File
 * 
 * Global setup for all tests
 */

// Polyfill TextEncoder/TextDecoder for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock browser APIs
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {}
};

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock console.error to reduce noise in tests
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && 
      (args[0].includes('Warning:') || 
       args[0].includes('Error:') ||
       args[0].includes('act('))) {
    return; // Skip React warnings in tests
  }
  originalError(...args);
};

// Set up environment variables
process.env.NEXT_PUBLIC_BASE_RPC_URL = 'https://mainnet.base.org';
process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL = 'https://mainnet.infura.io/v3/mock';
process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT = '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95';
process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Mock fetch for API calls
if (!global.fetch) {
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  );
}