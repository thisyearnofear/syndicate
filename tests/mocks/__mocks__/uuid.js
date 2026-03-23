// Mock for uuid module
module.exports = {
  v4: () => 'mock-uuid-' + Math.random().toString(36).substring(2, 9),
  v1: () => 'mock-uuid-' + Math.random().toString(36).substring(2, 9),
};
