import { generateResponse, ClaudeMessage } from '../../src/services/claudeService';
import { logger } from '../../src/utils/logger';
import { Anthropic } from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');
jest.mock('../../src/utils/logger');

const mockAnthropicInstance = {
  messages: {
    create: jest.fn()
  }
};

// Mock the Anthropic constructor
(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => {
  return mockAnthropicInstance as any;
});

describe('Claude Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should call the Claude API with the correct parameters', async () => {
      // Mock successful API response
      mockAnthropicInstance.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'This is a test response from Claude' }],
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      });

      // Call the service
      const result = await generateResponse('Test prompt');

      // Verify Anthropic API was called with correct parameters
      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-latest',
        messages: [{ role: 'user', content: 'Test prompt' }],
        max_tokens: 4000
      });

      // Verify the result structure
      expect(result).toEqual({
        content: 'This is a test response from Claude',
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      });
    });

    it('should use custom model if provided', async () => {
      // Mock successful API response
      mockAnthropicInstance.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'This is a test response from Claude' }],
        model: 'claude-3-opus-latest',
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      });

      // Call the service with custom model
      await generateResponse('Test prompt', [], 'claude-3-opus-latest');

      // Verify Anthropic API was called with correct model
      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-opus-latest',
        messages: [{ role: 'user', content: 'Test prompt' }],
        max_tokens: 4000
      });
    });

    it('should include previous messages if provided', async () => {
      // Mock successful API response
      mockAnthropicInstance.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'This is a test response from Claude' }],
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 200,
          output_tokens: 50
        }
      });

      // Previous messages
      const messages: ClaudeMessage[] = [
        { role: 'user', content: 'Hello Claude' },
        { role: 'assistant', content: 'Hello! How can I help you?' }
      ];

      // Call the service with previous messages
      await generateResponse('Test prompt', messages);

      // Verify Anthropic API was called with correct messages
      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-latest',
        messages: [
          ...messages,
          { role: 'user', content: 'Test prompt' }
        ],
        max_tokens: 4000
      });
    });

    it('should handle empty content in the response', async () => {
      // Mock API response with empty content
      mockAnthropicInstance.messages.create.mockResolvedValue({
        content: [],
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 100,
          output_tokens: 0
        }
      });

      // Call the service
      const result = await generateResponse('Test prompt');

      // Verify the result has empty content
      expect(result.content).toBe('');
    });

    it('should handle non-text content in the response', async () => {
      // Mock API response with non-text content
      mockAnthropicInstance.messages.create.mockResolvedValue({
        content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } }],
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 100,
          output_tokens: 10
        }
      });

      // Call the service
      const result = await generateResponse('Test prompt');

      // Verify the result has empty content
      expect(result.content).toBe('');
    });

    it('should throw an error if the Claude API fails', async () => {
      // Mock API error
      mockAnthropicInstance.messages.create.mockRejectedValue(new Error('API error'));

      // Expect the service to throw an error
      await expect(generateResponse('Test prompt')).rejects.toThrow('Failed to generate response from Claude: API error');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error calling Claude API:', expect.any(Error));
    });
  });
});
