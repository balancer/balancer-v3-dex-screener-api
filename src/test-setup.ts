// Test setup file to ensure proper isolation
import { beforeAll, afterAll } from 'bun:test';

// Store original modules
const originalModules = new Map();

beforeAll(() => {
    // Store original modules before any mocking
    originalModules.set('pair-util', require('./utils/pair-util'));
    originalModules.set('swap-util', require('./utils/swap-util'));
});

afterAll(() => {
    // Clean up any global state
    delete process.env.BUNIT_MOCK_UTILS;
});

export { originalModules };