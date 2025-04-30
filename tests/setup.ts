import { jest } from '@jest/globals';

// Mock the database module
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  },
}));

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the Anthropic/Claude SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Mocked Claude response' }],
          model: 'claude-3-5-sonnet-latest',
          usage: {
            input_tokens: 100,
            output_tokens: 50
          }
        }),
      },
    })),
  };
});

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid'),
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
