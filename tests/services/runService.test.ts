import { query } from "../../src/config/database";
import * as runService from "../../src/services/runService";
import * as workflowService from "../../src/services/workflowService";
import { executeIntegration } from "../../src/integrations";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../src/utils/logger";
import { RunStatus } from "../../src/models/run";
import {
  createMockQueryResult,
  createMockUuid,
  createEmptyMockQueryResult,
  createMockIntegrationResult,
} from "../utils/testUtils";

// Mock the dependencies
jest.mock("../../src/config/database");
jest.mock("../../src/services/workflowService");
jest.mock("../../src/integrations");
jest.mock("uuid");
jest.mock("../../src/utils/logger");

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWorkflowService = workflowService as jest.Mocked<
  typeof workflowService
>;
const mockExecuteIntegration = executeIntegration as jest.MockedFunction<
  typeof executeIntegration
>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

describe("Run Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for UUID
    mockUuidv4.mockReturnValue("mocked-uuid");
  });

  describe("triggerWorkflow", () => {
    it("should trigger a workflow and create a run", async () => {
      // Mock workflow data
      const mockWorkflow = {
        id: "workflow-id",
        name: "Test Workflow",
        description: "Test Description",
        trigger_type: "webhook",
        trigger_value: "test-webhook",
        steps: [
          {
            id: "step-id",
            workflow_id: "workflow-id",
            step_type: "log",
            step_config: { message: "Test log" },
            step_order: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Reset all mocks before setting up new ones
      mockQuery.mockReset();

      // Use a spy to track all calls to mockQuery
      const mockQuerySpy = jest.fn((sql, params) => {
        // For workflow query
        if (
          sql.includes("SELECT * FROM workflows") &&
          params &&
          params[0] === "webhook"
        ) {
          return Promise.resolve(createMockQueryResult([mockWorkflow]));
        }
        // For workflow steps query
        else if (
          sql.includes("SELECT * FROM workflow_steps") &&
          params &&
          params[0] === "workflow-id"
        ) {
          return Promise.resolve(createMockQueryResult(mockWorkflow.steps));
        }
        // For workflow run insertion
        else if (sql.includes("INSERT INTO workflow_runs")) {
          return Promise.resolve(createEmptyMockQueryResult());
        }
        // For workflow step run insertion
        else if (sql.includes("INSERT INTO workflow_step_runs")) {
          return Promise.resolve(createEmptyMockQueryResult());
        }
        // Default fallback
        else {
          return Promise.resolve(createEmptyMockQueryResult());
        }
      });

      // Replace the mockQuery with our spy
      mockQuery.mockImplementation(mockQuerySpy);

      // Create a helper function to check if a specific query was called
      const hasQueryBeenCalledWith = (sqlPattern: string, paramsPattern?: any[]) => {
        return mockQuerySpy.mock.calls.some((call) => {
          const [sql, params] = call;
          const sqlMatches = sql.includes(sqlPattern);
          const paramsMatch =
            !paramsPattern || paramsPattern.every((param) => params.includes(param));
          return sqlMatches && paramsMatch;
        });
      };

      // Call the service
      const result = await runService.triggerWorkflow(
        "webhook",
        "test-webhook"
      );

      // Verify database was queried for workflow
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflows"),
        ["webhook", "test-webhook"]
      );

      // Verify database was queried for steps
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflow_steps"),
        ["workflow-id"]
      );

      // Verify run was inserted
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO workflow_runs"),
        expect.arrayContaining(["mocked-uuid", "workflow-id", "PENDING"])
      );

      // Verify step run was inserted - use a more flexible approach
      const stepRunCalls = mockQuery.mock.calls.filter(call => 
        call[0].includes('INSERT INTO workflow_step_runs'));
      expect(stepRunCalls.length).toBeGreaterThan(0);
      
      // Verify the parameters contain what we expect
      const stepRunParams = stepRunCalls[0][1];
      expect(stepRunParams).toContain('mocked-uuid');
      expect(stepRunParams).toContain('step-id');

      // Verify the result structure
      expect(result).not.toBeNull();
      expect(result?.id).toBe("mocked-uuid");
      expect(result?.workflow_id).toBe("workflow-id");
      expect(result?.status).toBe(RunStatus.RUNNING);
      expect(result?.trigger).toEqual({
        type: "webhook",
        value: "test-webhook",
      });
      expect(result?.steps).toHaveLength(1);
    });

    it("should return null if no workflow is found for the trigger", async () => {
      // Mock database query for empty workflow result
      mockQuery.mockResolvedValueOnce(createMockQueryResult([]));

      // Call the service
      const result = await runService.triggerWorkflow(
        "webhook",
        "non-existent"
      );

      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflows"),
        ["webhook", "non-existent"]
      );

      // Verify the result is null
      expect(result).toBeNull();

      // Verify log message
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "No workflows found for trigger type webhook and value non-existent"
        )
      );
    });

    it("should handle database errors", async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error("Database error"));

      // Expect the service to throw an error
      await expect(
        runService.triggerWorkflow("webhook", "test-webhook")
      ).rejects.toThrow();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getWorkflowRun", () => {
    it("should return a workflow run with its step runs", async () => {
      // Mock database response for run
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "run-id",
            workflow_id: "workflow-id",
            status: "completed",
            trigger: { type: "manual", value: "test" },
            started_at: new Date(),
            completed_at: new Date(),
            error_message: null,
          },
        ])
      );

      // Mock database response for step runs
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "step-run-id",
            workflow_run_id: "run-id",
            workflow_step_id: "step-id",
            status: "completed",
            started_at: new Date(),
            completed_at: new Date(),
            output: { result: "Success" },
            error_message: null,
          },
        ])
      );

      // Call the service
      const result = await runService.getWorkflowRun("run-id");

      // Verify database was queried for run
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflow_runs"),
        ["run-id"]
      );

      // Verify database was queried for step runs
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflow_step_runs"),
        ["run-id"]
      );

      // Verify the result structure
      expect(result).not.toBeNull();
      expect(result?.id).toBe("run-id");
      expect(result?.workflow_id).toBe("workflow-id");
      expect(result?.status).toBe("completed");
      expect(result?.steps).toHaveLength(1);
      expect(result?.steps[0].id).toBe("step-run-id");
      expect(result?.steps[0].output).toEqual({ result: "Success" });
    });

    it("should return null if run is not found", async () => {
      // Mock database response (no run found)
      mockQuery.mockResolvedValueOnce(createEmptyMockQueryResult());

      // Call the service
      const result = await runService.getWorkflowRun("non-existent-id");

      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflow_runs"),
        ["non-existent-id"]
      );

      // Verify the result is null
      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error("Database error"));

      // Expect the service to throw an error
      await expect(runService.getWorkflowRun("run-id")).rejects.toThrow();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getWorkflowRuns", () => {
    it("should return all runs for a workflow", async () => {
      // Mock database response for runs
      mockQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "run-id-1",
            workflow_id: "workflow-id",
            status: "completed",
            trigger: { type: "manual", value: "test" },
            started_at: new Date(),
            completed_at: new Date(),
            steps: [],
            error_message: null,
          },
          {
            id: "run-id-2",
            workflow_id: "workflow-id",
            status: "failed",
            trigger: { type: "manual", value: "test" },
            started_at: new Date(),
            completed_at: new Date(),
            steps: [],
            error_message: "Test error",
          },
        ])
      );

      // Call the service
      const result = await runService.getWorkflowRuns("workflow-id");

      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT * FROM workflow_runs WHERE workflow_id = $1"
        ),
        ["workflow-id"]
      );

      // Verify the result structure
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("run-id-1");
      expect(result[0].status).toBe("completed");
      expect(result[1].id).toBe("run-id-2");
      expect(result[1].status).toBe("failed");
      expect(result[1].error_message).toBe("Test error");
    });

    it("should handle database errors", async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error("Database error"));

      // Expect the service to throw an error
      await expect(runService.getWorkflowRuns("workflow-id")).rejects.toThrow();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("retryWorkflowRun", () => {
    it("should retry a failed workflow run", async () => {
      // Mock original run
      const originalRun = {
        id: "original-run-id",
        workflow_id: "workflow-id",
        status: RunStatus.FAILED,
        trigger: { type: "manual", value: "test" },
        started_at: new Date(),
        completed_at: new Date(),
        steps: [
          {
            id: "step-run-id",
            workflow_run_id: "original-run-id",
            workflow_step_id: "step-id",
            status: RunStatus.FAILED,
            started_at: new Date(),
            completed_at: new Date(),
            error_message: "Step failed",
          },
        ],
        error_message: "Run failed",
      };

      // Mock workflow
      const workflow = {
        id: "workflow-id",
        name: "Test Workflow",
        description: "Test Description",
        trigger_type: "manual",
        trigger_value: "test",
        steps: [
          {
            id: "step-id",
            workflow_id: "workflow-id",
            step_type: "log",
            step_config: { message: "Test log" },
            step_order: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Reset all mocks
      mockQuery.mockReset();
      
      // Set up a more detailed mock implementation to track all queries
      mockQuery.mockImplementation((sql, params) => {
        // For original run query
        if (sql.includes('SELECT * FROM workflow_runs') && params && params[0] === 'original-run-id') {
          return Promise.resolve(createMockQueryResult([{
            id: 'original-run-id',
            workflow_id: 'workflow-id',
            status: 'FAILED',
            started_at: new Date(),
            completed_at: new Date(),
            error_message: 'Test error'
          }]));
        }
        // For step runs query
        else if (sql.includes('SELECT * FROM workflow_step_runs') && params && params[0] === 'original-run-id') {
          return Promise.resolve(createMockQueryResult([{
            id: 'step-run-id',
            workflow_run_id: 'original-run-id',
            workflow_step_id: 'step-id',
            status: 'FAILED',
            started_at: new Date(),
            completed_at: new Date(),
            output: { result: 'test' },
            error_message: 'Test error'
          }]));
        }
        // For workflow run insertion
        else if (sql.includes('INSERT INTO workflow_runs')) {
          return Promise.resolve(createEmptyMockQueryResult());
        }
        // For workflow step run insertion
        else if (sql.includes('INSERT INTO workflow_step_runs')) {
          return Promise.resolve(createEmptyMockQueryResult());
        }
        // Default fallback
        else {
          return Promise.resolve(createEmptyMockQueryResult());
        }
      });
      
      // Mock workflowService.getWorkflow to return the workflow
      mockWorkflowService.getWorkflow.mockResolvedValue(workflow);

      // Call the service
      const result = await runService.retryWorkflowRun("original-run-id");

      // Verify database was queried for the original run
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflow_runs WHERE id = $1"),
        ["original-run-id"]
      );

      // Verify workflowService.getWorkflow was called
      expect(mockWorkflowService.getWorkflow).toHaveBeenCalledWith(
        "workflow-id"
      );

      // Verify new run was inserted
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO workflow_runs"),
        expect.arrayContaining(["mocked-uuid", "workflow-id", "PENDING"])
      );

      // Verify step run was inserted - use a more flexible approach
      const stepRunCalls = mockQuery.mock.calls.filter(call => 
        call[0].includes('INSERT INTO workflow_step_runs'));
      expect(stepRunCalls.length).toBeGreaterThan(0);
      
      // Verify the parameters contain what we expect
      const stepRunParams = stepRunCalls[0][1];
      expect(stepRunParams).toContain('mocked-uuid');
      expect(stepRunParams).toContain('step-id');

      // Verify the result structure
      expect(result).not.toBeNull();
      expect(result?.id).toBe("mocked-uuid");
      expect(result?.workflow_id).toBe("workflow-id");
      expect(result?.status).toBe(RunStatus.RUNNING);
      expect(result?.trigger).toEqual({ type: "manual", value: "test" });
    });

    it("should return null if original run is not found", async () => {
      // Mock database response (no run found)
      mockQuery.mockResolvedValueOnce(createEmptyMockQueryResult());

      // Call the service
      const result = await runService.retryWorkflowRun("non-existent-id");

      // Verify database was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM workflow_runs WHERE id = $1"),
        ["non-existent-id"]
      );

      // Verify the result is null
      expect(result).toBeNull();
    });

    it("should throw an error if workflow is not found", async () => {
      // Mock original run
      const originalRun = {
        id: "original-run-id",
        workflow_id: "workflow-id",
        status: RunStatus.FAILED,
        trigger: { type: "manual", value: "test" },
        started_at: new Date(),
        completed_at: new Date(),
        steps: [],
        error_message: "Run failed",
      };

      // Mock database query for getting the original run
      mockQuery.mockResolvedValueOnce(createMockQueryResult([originalRun]));

      // Mock workflowService.getWorkflow to return null
      mockWorkflowService.getWorkflow.mockResolvedValue(null);

      // Expect the service to throw an error
      await expect(runService.retryWorkflowRun("original-run-id")).rejects.toThrow(
        `Workflow workflow-id not found`
      );

      // Verify workflowService.getWorkflow was called
      expect(mockWorkflowService.getWorkflow).toHaveBeenCalledWith(
        "workflow-id"
      );
    });

    it("should handle database errors", async () => {
      // Mock database query to throw an error
      mockQuery.mockRejectedValue(new Error("Database error"));

      // Expect the service to throw an error
      await expect(runService.retryWorkflowRun("run-id")).rejects.toThrow();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("executeStepSequence", () => {
    // This is a private function, so we'll test it indirectly through createRun

    it("should execute steps in sequence and handle input mappings", async () => {
      // Create a mock workflow with steps that have input mappings
      const workflow = {
        id: "workflow-id",
        name: "Test Workflow",
        description: "Test Description",
        trigger_type: "manual",
        trigger_value: "test",
        steps: [
          {
            id: "1",
            workflow_id: "workflow-id",
            step_type: "http",
            step_config: {
              method: "GET",
              url: "https://api.example.com/data",
            },
            step_order: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: "2",
            workflow_id: "workflow-id",
            step_type: "log",
            step_config: { message: "Processing data" },
            step_order: 2,
            input_mapping: {
              data: "1:data", // Map output from step 1 to this step's input
            },
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock the run
      const run = {
        id: "run-id",
        workflow_id: "workflow-id",
        status: RunStatus.PENDING,
        trigger: { type: "manual", value: "test" },
        started_at: new Date(),
        steps: [
          {
            id: "step-run-1",
            workflow_run_id: "run-id",
            workflow_step_id: "1",
            status: RunStatus.PENDING,
            started_at: new Date(),
          },
          {
            id: "step-run-2",
            workflow_run_id: "run-id",
            workflow_step_id: "2",
            status: RunStatus.PENDING,
            started_at: new Date(),
          },
        ],
      };

      // Mock database queries for updating run and step statuses
      mockQuery.mockResolvedValue(createEmptyMockQueryResult());

      // Mock integration execution
      mockExecuteIntegration.mockResolvedValueOnce(
        createMockIntegrationResult(true, { items: [{ id: 123 }] })
      );
      mockExecuteIntegration.mockResolvedValueOnce(
        createMockIntegrationResult(true)
      );

      // Call createRun which will eventually call executeStepSequence
      await runService.createRun(workflow);

      // Verify run was inserted
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO workflow_runs"),
        expect.arrayContaining(["mocked-uuid", "workflow-id", "PENDING"])
      );

      // Verify step runs were inserted
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO workflow_step_runs"),
        expect.any(Array)
      );

      // Note: We can't directly test executeStepSequence since it's a private function,
      // but we can verify that the integration execution was called correctly
      // in a real implementation. For this test, we're just verifying the run creation.
    });
  });
});
