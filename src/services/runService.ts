import { query } from "../config/database";
import { WorkflowRun, RunStatus } from "../models/run";
import { Workflow } from "../models/workflow";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import * as workflowService from "./workflowService";

// Mock integrations
const mockIntegrations = {
  email: async (config: any) => {
    logger.info(
      `MOCK: Sending email to ${config.to} with subject "${config.subject}"`
    );
    return { success: true, messageId: uuidv4() };
  },
  slack: async (config: any) => {
    logger.info(
      `MOCK: Sending Slack message to channel ${config.channel}: "${config.message}"`
    );
    return { success: true, timestamp: new Date().toISOString() };
  },
  http: async (config: any) => {
    logger.info(`MOCK: Making HTTP ${config.method} request to ${config.url}`);
    return { success: true, status: 200, data: { message: "Success" } };
  },
  log: async (config: any) => {
    logger.info(`WORKFLOW LOG: ${config.message}`);
    return { success: true };
  },
};

export async function triggerWorkflow(
  triggerType: string,
  triggerValue: string
): Promise<WorkflowRun | null> {
  try {
    // Find workflows matching the trigger
    const result = await query(
      `SELECT * FROM workflows 
       WHERE trigger->>'type' = $1 AND trigger->>'value' = $2`,
      [triggerType, triggerValue]
    );

    if (result.rows.length === 0) {
      logger.info(
        `No workflows found for trigger type ${triggerType} and value ${triggerValue}`
      );
      return null;
    }

    // Get the first matching workflow
    const workflowRow = result.rows[0];
    const workflow: Workflow = {
      id: workflowRow.id,
      name: workflowRow.name,
      description: workflowRow.description,
      trigger: workflowRow.trigger,
      steps: workflowRow.steps,
      createdAt: workflowRow.created_at,
      updatedAt: workflowRow.updated_at,
    };

    // Create a new run
    return await createRun(workflow);
  } catch (error) {
    logger.error(
      `Error triggering workflow for ${triggerType}:${triggerValue}:`,
      error
    );
    throw error;
  }
}

export async function createRun(workflow: Workflow): Promise<WorkflowRun> {
  try {
    // Create a new run ID
    const runId = uuidv4();

    const run: WorkflowRun = {
      id: runId,
      workflow_id: workflow.id,
      status: RunStatus.PENDING,
      trigger: {
        type: workflow.trigger_type,
        value: workflow.trigger_value,
      },
      started_at: new Date(),
      steps: workflow.steps
        ? workflow.steps.map((step) => ({
            id: step.id,
            workflow_run_id: parseInt(runId),
            workflow_step_id: step.id,
            status: "pending",
            started_at: new Date(),
            output: undefined,
            error_message: undefined,
          }))
        : [],
    };

    // Insert the run into the database
    await query(
      `INSERT INTO workflow_runs (id, workflow_id, status, trigger, started_at, steps)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        run.id,
        run.workflow_id,
        run.status,
        JSON.stringify(run.trigger),
        run.started_at,
        JSON.stringify(run.steps),
      ]
    );

    // Execute the run asynchronously
    executeRun(run, workflow).catch((error) => {
      logger.error(`Error executing run ${run.id}:`, error);
    });

    return run;
  } catch (error) {
    logger.error("Error creating run:", error);
    throw error;
  }
}

async function executeRun(run: WorkflowRun, workflow: Workflow): Promise<void> {
  try {
    // Update run status to RUNNING
    run.status = RunStatus.RUNNING;
    await updateRunStatus(run.id, RunStatus.RUNNING);

    // Execute each step in sequence
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepRun = run.steps[i];

      // Update step status to RUNNING
      stepRun.status = RunStatus.RUNNING;
      await updateStepStatus(run.id, stepRun.id, RunStatus.RUNNING);

      try {
        // Execute the step using the appropriate integration
        const actionType = step.action.type;
        if (!mockIntegrations[actionType]) {
          throw new Error(`Unknown action type: ${actionType}`);
        }

        const output = await mockIntegrations[actionType](step.action.config);

        // Update step status to COMPLETED
        stepRun.status = RunStatus.COMPLETED;
        stepRun.completed_at = new Date();
        stepRun.output = output;
        await updateStepStatus(run.id, stepRun.id, RunStatus.COMPLETED, output);
      } catch (error) {
        // Update step status to FAILED
        stepRun.status = RunStatus.FAILED;
        stepRun.completed_at = new Date();
        stepRun.error_message = error.message;
        await updateStepStatus(
          run.id,
          stepRun.id,
          RunStatus.FAILED,
          null,
          error.message
        );

        // Update run status to FAILED
        run.status = RunStatus.FAILED;
        run.completedAt = new Date();
        run.error = `Step ${i + 1} failed: ${error.message}`;
        await updateRunStatus(run.id, RunStatus.FAILED, run.error);

        return;
      }
    }

    // All steps completed successfully
    run.status = RunStatus.COMPLETED;
    run.completedAt = new Date();
    await updateRunStatus(run.id, RunStatus.COMPLETED);
  } catch (error) {
    // Update run status to FAILED
    run.status = RunStatus.FAILED;
    run.completedAt = new Date();
    run.error = `Run execution error: ${error.message}`;
    await updateRunStatus(run.id, RunStatus.FAILED, run.error);
  }
}

async function updateRunStatus(
  runId: string,
  status: RunStatus,
  error?: string
): Promise<void> {
  const completedAt =
    status === RunStatus.COMPLETED || status === RunStatus.FAILED
      ? new Date()
      : null;

  await query(
    `UPDATE workflow_runs 
     SET status = $1, completed_at = $2, error = $3
     WHERE id = $4`,
    [status, completedAt, error, runId]
  );
}

async function updateStepStatus(
  runId: string,
  stepId: string,
  status: RunStatus,
  output?: any,
  error?: string
): Promise<void> {
  const completedAt =
    status === RunStatus.COMPLETED || status === RunStatus.FAILED
      ? new Date()
      : null;

  await query(
    `UPDATE workflow_runs 
     SET steps = jsonb_set(
       steps,
       '{${stepId}}',
       jsonb_build_object(
         'id', '${stepId}',
         'status', '${status}',
         'completedAt', ${
           completedAt ? `'${completedAt.toISOString()}'` : "null"
         },
         'output', ${output ? `'${JSON.stringify(output)}'` : "null"},
         'error', ${error ? `'${error}'` : "null"}
       )
     )
     WHERE id = $1`,
    [runId]
  );
}

export async function getWorkflowRuns(
  workflowId: string
): Promise<WorkflowRun[]> {
  try {
    const result = await query(
      "SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY started_at DESC",
      [workflowId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      trigger: row.trigger,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      steps: row.steps,
      error: row.error,
    }));
  } catch (error) {
    logger.error(`Error getting runs for workflow ${workflowId}:`, error);
    throw error;
  }
}

export async function getWorkflowRun(
  runId: string
): Promise<WorkflowRun | null> {
  try {
    const result = await query("SELECT * FROM workflow_runs WHERE id = $1", [
      runId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      trigger: row.trigger,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      steps: row.steps,
      error: row.error,
    };
  } catch (error) {
    logger.error(`Error getting run ${runId}:`, error);
    throw error;
  }
}

export async function retryWorkflowRun(
  runId: string
): Promise<WorkflowRun | null> {
  try {
    // Get the failed run
    const run = await getWorkflowRun(runId);
    if (!run) {
      return null;
    }

    // Only failed runs can be retried
    if (run.status !== RunStatus.FAILED) {
      throw new Error(`Cannot retry run with status ${run.status}`);
    }

    // Get the workflow
    const workflow = await workflowService.getWorkflow(run.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${run.workflowId} not found`);
    }

    // Create a new run
    return await createRun(workflow);
  } catch (error) {
    logger.error(`Error retrying run ${runId}:`, error);
    throw error;
  }
}

export default {
  triggerWorkflow,
  getWorkflowRuns,
  getWorkflowRun,
  retryWorkflowRun,
};
