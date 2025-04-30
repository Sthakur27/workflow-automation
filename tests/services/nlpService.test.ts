import { inferWorkflowConfig } from '../../src/services/nlpService';
import * as claudeService from '../../src/services/claudeService';
import { logger } from '../../src/utils/logger';

// Mock the claudeService
jest.mock('../../src/services/claudeService');
jest.mock('../../src/utils/logger');

const mockClaudeService = claudeService as jest.Mocked<typeof claudeService>;

describe('NLP Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('inferWorkflowConfig', () => {
    it('should correctly parse a valid Claude response', async () => {
      // Mock Claude response with valid JSON
      const mockClaudeResponse = {
        content: `Here's the workflow configuration:
        {
          "description": "Send email notifications when new purchase orders are created",
          "trigger_type": "webhook",
          "trigger_value": "new-purchase-order",
          "trigger_description": "Triggered when a new purchase order is created in the system",
          "steps": [
            {
              "step_type": "email",
              "step_config": {
                "to": "purchasing@example.com",
                "subject": "New Purchase Order Created",
                "body": "A new purchase order has been created in the system."
              },
              "step_order": 1,
              "description": "Send email notification to purchasing department"
            },
            {
              "step_type": "slack",
              "step_config": {
                "channel": "purchasing",
                "message": "New purchase order alert: A new PO has been created."
              },
              "step_order": 2,
              "description": "Send Slack notification to purchasing channel"
            }
          ]
        }`,
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 500,
          output_tokens: 300
        }
      };

      mockClaudeService.generateResponse.mockResolvedValue(mockClaudeResponse);

      const result = await inferWorkflowConfig(
        'Create a workflow that sends email and Slack notifications when a new purchase order is created',
        'Purchase Order Notification'
      );

      // Verify Claude was called with the correct prompt
      expect(mockClaudeService.generateResponse).toHaveBeenCalledTimes(1);
      expect(mockClaudeService.generateResponse.mock.calls[0][0]).toContain('Purchase Order Notification');
      expect(mockClaudeService.generateResponse.mock.calls[0][0]).toContain('Create a workflow that sends email and Slack notifications');

      // Verify the parsed result
      expect(result).toEqual({
        description: 'Send email notifications when new purchase orders are created',
        trigger_type: 'webhook',
        trigger_value: 'new-purchase-order',
        trigger_description: 'Triggered when a new purchase order is created in the system',
        steps: [
          {
            step_type: 'email',
            step_config: {
              to: 'purchasing@example.com',
              subject: 'New Purchase Order Created',
              body: 'A new purchase order has been created in the system.'
            },
            step_order: 1,
            description: 'Send email notification to purchasing department'
          },
          {
            step_type: 'slack',
            step_config: {
              channel: 'purchasing',
              message: 'New purchase order alert: A new PO has been created.'
            },
            step_order: 2,
            description: 'Send Slack notification to purchasing channel'
          }
        ]
      });
    });

    it('should throw an error if Claude response does not contain JSON', async () => {
      // Mock Claude response with no JSON
      const mockClaudeResponse = {
        content: 'I cannot create a workflow configuration for this request.',
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 200,
          output_tokens: 50
        }
      };

      mockClaudeService.generateResponse.mockResolvedValue(mockClaudeResponse);

      await expect(inferWorkflowConfig(
        'Invalid workflow description',
        'Invalid Workflow'
      )).rejects.toThrow('Failed to extract JSON from Claude response');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw an error if parsed JSON is invalid', async () => {
      // Mock Claude response with invalid JSON (missing required fields)
      const mockClaudeResponse = {
        content: `{
          "description": "Invalid workflow",
          "trigger_type": "manual"
          // Missing trigger_value and steps
        }`,
        model: 'claude-3-5-sonnet-latest',
        usage: {
          input_tokens: 200,
          output_tokens: 100
        }
      };

      mockClaudeService.generateResponse.mockResolvedValue(mockClaudeResponse);

      await expect(inferWorkflowConfig(
        'Invalid workflow description',
        'Invalid Workflow'
      )).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw an error if Claude service fails', async () => {
      // Mock Claude service error
      mockClaudeService.generateResponse.mockRejectedValue(new Error('Claude API error'));

      await expect(inferWorkflowConfig(
        'Test workflow description',
        'Test Workflow'
      )).rejects.toThrow('Failed to infer workflow configuration: Claude API error');

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
