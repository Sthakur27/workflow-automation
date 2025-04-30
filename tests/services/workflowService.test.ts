import { query, pool } from '../../src/config/database';
import * as workflowService from '../../src/services/workflowService';
import * as nlpService from '../../src/services/nlpService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../src/utils/logger';

// Mock the dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/nlpService');
jest.mock('uuid');
jest.mock('../../src/utils/logger');

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockPool = pool as jest.Mocked<typeof pool>;
const mockNlpService = nlpService as jest.Mocked<typeof nlpService>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

describe('Workflow Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock for UUID
    mockUuidv4.mockReturnValue('mocked-uuid');
    
    // Default mock for database client
    mockPool.connect.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    } as any);
  });

  describe('createWorkflow', () => {
    it('should create a workflow with inferred configuration from NLP', async () => {
      // Mock the NLP service response
      const inferredConfig = {
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
          }
        ]
      };
      
      mockNlpService.inferWorkflowConfig.mockResolvedValue(inferredConfig);
      
      // Mock database responses
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      
      // Mock workflow insertion response
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'workflow-uuid',
          name: 'Purchase Order Notification',
          description: 'Send email notifications when new purchase orders are created',
          trigger_type: 'webhook',
          trigger_value: 'new-purchase-order',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });
      
      // Mock step insertion response
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'step-uuid',
          workflow_id: 'workflow-uuid',
          step_type: 'email',
          step_config: {
            to: 'purchasing@example.com',
            subject: 'New Purchase Order Created',
            body: 'A new purchase order has been created in the system.'
          },
          step_order: 1,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });
      
      // Call the service
      const result = await workflowService.createWorkflow({
        name: 'Purchase Order Notification',
        natural_language_description: 'Create a workflow that sends email notifications when a new purchase order is created'
      });
      
      // Verify NLP service was called correctly
      expect(mockNlpService.inferWorkflowConfig).toHaveBeenCalledWith(
        'Create a workflow that sends email notifications when a new purchase order is created',
        'Purchase Order Notification'
      );
      
      // Verify database transaction was started
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      
      // Verify workflow was inserted
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflows'),
        expect.arrayContaining(['Purchase Order Notification'])
      );
      
      // Verify step was inserted
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflow_steps'),
        expect.arrayContaining(['workflow-uuid', 'email'])
      );
      
      // Verify transaction was committed
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      
      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
      
      // Verify the response structure
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('inferred_data');
      expect(result).toHaveProperty('metadata');
      expect(result.workflow.name).toBe('Purchase Order Notification');
      expect(result.workflow.trigger_type).toBe('webhook');
      expect(result.workflow.trigger_value).toBe('new-purchase-order');
      expect(result.workflow.steps).toHaveLength(1);
      expect(result.workflow.steps[0].step_type).toBe('email');
    });
    
    it('should handle NLP service errors and use default values', async () => {
      // Mock NLP service to throw an error
      mockNlpService.inferWorkflowConfig.mockRejectedValue(new Error('NLP service error'));
      
      // Mock database responses
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      
      // Mock workflow insertion response
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'workflow-uuid',
          name: 'Test Workflow',
          description: '',
          trigger_type: 'manual',
          trigger_value: 'test_workflow',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });
      
      // Call the service
      const result = await workflowService.createWorkflow({
        name: 'Test Workflow',
        natural_language_description: 'This will fail'
      });
      
      // Verify NLP service was called
      expect(mockNlpService.inferWorkflowConfig).toHaveBeenCalled();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error inferring workflow configuration:',
        expect.any(Error)
      );
      
      // Verify default values were used
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflows'),
        expect.arrayContaining(['Test Workflow', '', 'manual', 'test_workflow'])
      );
      
      // Verify transaction was committed
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      
      // Verify the response has default values
      expect(result.workflow.trigger_type).toBe('manual');
      expect(result.workflow.trigger_value).toBe('test_workflow');
    });
    
    it('should handle database errors and rollback the transaction', async () => {
      // Mock NLP service
      mockNlpService.inferWorkflowConfig.mockResolvedValue({
        description: 'Test description',
        trigger_type: 'manual',
        trigger_value: 'test',
        trigger_description: 'Test trigger',
        steps: []
      });
      
      // Mock database client with an error during workflow insertion
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);
      
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({});
      
      // Mock workflow insertion to throw an error
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Expect the service to throw an error
      await expect(workflowService.createWorkflow({
        name: 'Test Workflow',
        natural_language_description: 'This will fail at the database level'
      })).rejects.toThrow();
      
      // Verify transaction was started
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      
      // Verify transaction was rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      
      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('listWorkflows', () => {
    it('should return a list of workflows with their steps', async () => {
      // Mock database response for workflows
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workflow-1',
            name: 'Workflow 1',
            description: 'Description 1',
            trigger_type: 'manual',
            trigger_value: 'workflow_1',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'workflow-2',
            name: 'Workflow 2',
            description: 'Description 2',
            trigger_type: 'webhook',
            trigger_value: 'webhook-event',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });
      
      // Mock database response for steps of workflow 1
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'step-1',
            workflow_id: 'workflow-1',
            step_type: 'log',
            step_config: { message: 'Test log' },
            step_order: 1,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });
      
      // Mock database response for steps of workflow 2
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'step-2',
            workflow_id: 'workflow-2',
            step_type: 'http',
            step_config: { method: 'GET', url: 'https://example.com' },
            step_order: 1,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'step-3',
            workflow_id: 'workflow-2',
            step_type: 'email',
            step_config: { to: 'test@example.com', subject: 'Test', body: 'Test email' },
            step_order: 2,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });
      
      // Call the service
      const result = await workflowService.listWorkflows();
      
      // Verify database was queried for workflows
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflows'),
        []
      );
      
      // Verify database was queried for steps of each workflow
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflow_steps WHERE workflow_id = $1'),
        ['workflow-1']
      );
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflow_steps WHERE workflow_id = $1'),
        ['workflow-2']
      );
      
      // Verify the result structure
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('workflow-1');
      expect(result[0].steps).toHaveLength(1);
      expect(result[1].id).toBe('workflow-2');
      expect(result[1].steps).toHaveLength(2);
    });
    
    it('should handle database errors', async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error('Database error'));
      
      // Expect the service to throw an error
      await expect(workflowService.listWorkflows()).rejects.toThrow();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getWorkflow', () => {
    it('should return a workflow with its steps by ID', async () => {
      // Mock database response for workflow
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workflow-id',
            name: 'Test Workflow',
            description: 'Test Description',
            trigger_type: 'manual',
            trigger_value: 'test_workflow',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });
      
      // Mock database response for steps
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'step-id',
            workflow_id: 'workflow-id',
            step_type: 'claude',
            step_config: { prompt: 'Generate content' },
            step_order: 1,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });
      
      // Call the service
      const result = await workflowService.getWorkflow('workflow-id');
      
      // Verify database was queried for workflow
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflows WHERE id = $1'),
        ['workflow-id']
      );
      
      // Verify database was queried for steps
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflow_steps WHERE workflow_id = $1'),
        ['workflow-id']
      );
      
      // Verify the result structure
      expect(result).not.toBeNull();
      expect(result?.id).toBe('workflow-id');
      expect(result?.name).toBe('Test Workflow');
      expect(result?.steps).toHaveLength(1);
      expect(result?.steps?.[0].step_type).toBe('claude');
    });
    
    it('should return null if workflow is not found', async () => {
      // Mock database response for workflow (not found)
      mockQuery.mockResolvedValueOnce({
        rows: []
      });
      
      // Call the service
      const result = await workflowService.getWorkflow('non-existent-id');
      
      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflows WHERE id = $1'),
        ['non-existent-id']
      );
      
      // Verify the result is null
      expect(result).toBeNull();
    });
    
    it('should handle database errors', async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error('Database error'));
      
      // Expect the service to throw an error
      await expect(workflowService.getWorkflow('workflow-id')).rejects.toThrow();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getWorkflowByName', () => {
    it('should return a workflow with its steps by name', async () => {
      // Mock database response
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'workflow-id',
            name: 'Test Workflow',
            description: 'Test Description',
            trigger_type: 'manual',
            trigger_value: 'test_workflow',
            created_at: new Date(),
            updated_at: new Date(),
            steps: JSON.stringify([
              {
                id: 'step-id',
                workflow_id: 'workflow-id',
                step_type: 'log',
                step_config: { message: 'Test log' },
                step_order: 1,
                created_at: new Date(),
                updated_at: new Date()
              }
            ])
          }
        ]
      });
      
      // Call the service
      const result = await workflowService.getWorkflowByName('Test Workflow');
      
      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['Test Workflow']
      );
      
      // Verify the result structure
      expect(result).not.toBeNull();
      expect(result?.id).toBe('workflow-id');
      expect(result?.name).toBe('Test Workflow');
      expect(result?.steps).toHaveLength(1);
    });
    
    it('should return null if workflow is not found', async () => {
      // Mock database response (not found)
      mockQuery.mockResolvedValueOnce({
        rows: []
      });
      
      // Call the service
      const result = await workflowService.getWorkflowByName('Non-existent Workflow');
      
      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['Non-existent Workflow']
      );
      
      // Verify the result is null
      expect(result).toBeNull();
    });
    
    it('should handle database errors', async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error('Database error'));
      
      // Expect the service to throw an error
      await expect(workflowService.getWorkflowByName('Test Workflow')).rejects.toThrow();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
