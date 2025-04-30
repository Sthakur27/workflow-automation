import { query } from "../config/database";
import { WorkflowRun, RunStatus } from "../models/run";
import { Workflow } from "../models/workflow";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import * as workflowService from "./workflowService";

// Import the integration module
import { executeIntegration } from "../integrations";

export async function triggerWorkflow(
  triggerType: string,
  triggerValue: string
): Promise<WorkflowRun | null> {
  try {
    logger.info(`Triggering workflow for ${triggerType}:${triggerValue}`);

    // Find the workflow matching the trigger
    const workflowResult = await query(
      `SELECT * FROM workflows 
       WHERE trigger_type = $1 AND trigger_value = $2`,
      [triggerType, triggerValue]
    );

    if (workflowResult.rows.length === 0) {
      logger.info(
        `No workflows found for trigger type ${triggerType} and value ${triggerValue}`
      );
      return null;
    }

    logger.info(
      `Found ${workflowResult.rows.length} workflows for trigger type ${triggerType} and value ${triggerValue}`
    );

    // Get the first matching workflow
    const workflowRow = workflowResult.rows[0];

    // Then, get the steps for this workflow
    const stepsResult = await query(
      `SELECT * FROM workflow_steps 
       WHERE workflow_id = $1 
       ORDER BY step_order`,
      [workflowRow.id]
    );

    // Create the workflow object with its steps
    const workflow: Workflow = {
      id: workflowRow.id,
      name: workflowRow.name,
      description: workflowRow.description,
      trigger_type: workflowRow.trigger_type,
      trigger_value: workflowRow.trigger_value,
      steps: stepsResult.rows.map((step) => ({
        id: step.id,
        workflow_id: step.workflow_id,
        step_type: step.step_type,
        step_config: step.step_config,
        step_order: step.step_order,
        created_at: step.created_at,
        updated_at: step.updated_at,
      })),
      created_at: workflowRow.created_at,
      updated_at: workflowRow.updated_at,
    };

    logger.info(
      `Triggering workflow ${
        workflow.name
      } for ${triggerType}:${triggerValue} with ${
        workflow.steps?.length || 0
      } steps`
    );

    if (!workflow.steps || workflow.steps.length === 0) {
      logger.warn(
        `Workflow ${workflow.name} has no steps. This may indicate a data retrieval issue.`
      );
    }

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
            id: uuidv4(), // Generate a new UUID for each step run
            workflow_run_id: runId, // Use the run UUID directly
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
      `INSERT INTO workflow_runs (id, workflow_id, status, started_at, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [run.id, run.workflow_id, run.status, run.started_at, null]
    );

    // Insert each step run into the database
    if (run.steps && run.steps.length > 0) {
      for (const stepRun of run.steps) {
        await query(
          `INSERT INTO workflow_step_runs (id, workflow_run_id, workflow_step_id, status, started_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            stepRun.id,
            stepRun.workflow_run_id,
            stepRun.workflow_step_id,
            stepRun.status,
            stepRun.started_at,
          ]
        );
      }
      logger.info(
        `Created ${run.steps.length} step runs for workflow run ${run.id}`
      );
    }

    logger.info(`Created run ${run.id} for workflow ${workflow.name}`);
    logger.info(`Executing run ${run.id}`);

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
    logger.info(
      `Starting execution of run ${run.id} for workflow ${workflow.name} (${workflow.id})`
    );

    // Update run status to RUNNING
    run.status = RunStatus.RUNNING;
    await updateRunStatus(run.id, RunStatus.RUNNING);
    logger.info(`Run ${run.id} status updated to RUNNING`);

    // Store the outputs of each step to be used by subsequent steps
    const stepOutputs: { [stepId: string]: any } = {};

    // Execute each step in sequence
    if (!workflow.steps || workflow.steps.length === 0) {
      logger.info(`No steps to execute for run ${run.id}`);
      // No steps to execute, mark as completed
      run.status = RunStatus.COMPLETED;
      run.completed_at = new Date();
      await updateRunStatus(run.id, RunStatus.COMPLETED);
      return;
    }

    // Start executing steps sequentially
    await executeStepSequence(run, workflow, 0, stepOutputs);

    // Note: All steps completed successfully is now handled in executeStepSequence
  } catch (error) {
    // Update run status to FAILED
    run.status = RunStatus.FAILED;
    run.completed_at = new Date();
    run.error_message = `Run execution error: ${(error as Error).message}`;
    await updateRunStatus(run.id, RunStatus.FAILED, run.error_message);
    logger.error(
      `Run ${run.id} failed with error: ${(error as Error).message}`
    );
  }
}

/**
 * Execute workflow steps sequentially
 * @param run The workflow run
 * @param workflow The workflow
 * @param stepIndex The current step index
 * @param stepOutputs The outputs from previous steps
 */
async function executeStepSequence(
  run: WorkflowRun,
  workflow: Workflow,
  stepIndex: number,
  stepOutputs: { [stepId: string]: any }
): Promise<void> {
  // Check if we've completed all steps
  if (stepIndex >= workflow.steps!.length) {
    // All steps completed successfully
    run.status = RunStatus.COMPLETED;
    run.completed_at = new Date();
    await updateRunStatus(run.id, RunStatus.COMPLETED);
    logger.info(
      `Run ${run.id} for workflow ${
        workflow.name
      } completed successfully with ${workflow.steps?.length || 0} steps`
    );
    return;
  }

  const step = workflow.steps![stepIndex];
  const stepRun = run.steps[stepIndex];

  // Update step status to RUNNING
  stepRun.status = RunStatus.RUNNING;
  await updateStepStatus(run.id, stepRun.id, RunStatus.RUNNING);

  try {
    // Process input mapping if it exists
    let stepConfig = { ...step.step_config };

    logger.info(`Processing input mapping for step ${step.id}`);

    if (step.input_mapping) {
      // Process each input mapping
      for (const [inputKey, mappingValue] of Object.entries(
        step.input_mapping
      )) {
        // Check if it's a reference to a previous step's output
        if (typeof mappingValue === "string" && mappingValue.includes(":")) {
          const [refStepId, outputPath] = mappingValue.split(":");
          const stepId = parseInt(refStepId, 10);

          // Ensure the referenced step exists and has output
          if (stepOutputs[stepId]) {
            // Navigate the output path (e.g., "data.items.0.id")
            let value = stepOutputs[stepId];
            const pathParts = outputPath.split(".");

            for (const part of pathParts) {
              if (value && typeof value === "object" && part in value) {
                value = value[part];
              } else {
                value = undefined;
                break;
              }
            }

            // Set the input value from the previous step's output
            stepConfig[inputKey] = value;

            // Log the data passing between steps
            logger.info(
              `Passing data from step ${stepId} to step ${
                step.id
              }: ${inputKey} = ${JSON.stringify(value)}`
            );
          } else {
            logger.warn(`Referenced step ${stepId} not found or has no output`);
          }
        }
      }
    }

    // Execute the step using the appropriate integration
    const stepType = step.step_type;
    logger.info(
      `Executing step ${stepIndex + 1} (${stepType}) for run ${run.id}`
    );
    logger.info(`Step config: ${JSON.stringify(stepConfig)}`);

    // Pass the processed config to the integration using our helper function
    logger.info(`Calling integration: ${stepType}`);
    const output = await executeIntegration(stepType, stepConfig);
    logger.info(`Integration ${stepType} executed successfully`);
    if (stepType === "claude") {
      logger.info(
        `Claude response received: ${JSON.stringify(output).substring(
          0,
          200
        )}...`
      );
    }

    // Store the output for potential use by subsequent steps
    stepOutputs[step.id] = output;

    // Update step status to COMPLETED
    stepRun.status = RunStatus.COMPLETED;
    stepRun.completed_at = new Date();
    stepRun.output = output;
    await updateStepStatus(run.id, stepRun.id, RunStatus.COMPLETED, output);
    logger.info(
      `Step ${stepIndex + 1} (${stepType}) completed successfully for run ${
        run.id
      }`
    );

    // Continue to the next step
    await executeStepSequence(run, workflow, stepIndex + 1, stepOutputs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Update step status to FAILED
    stepRun.status = RunStatus.FAILED;
    stepRun.completed_at = new Date();
    stepRun.error_message = message;
    await updateStepStatus(run.id, stepRun.id, RunStatus.FAILED, null, message);
    logger.error(
      `Step ${stepIndex + 1} (${step.step_type}) failed for run ${
        run.id
      }: ${message}`
    );

    // Update run status to FAILED
    run.status = RunStatus.FAILED;
    run.completed_at = new Date();
    run.error_message = `Step ${stepIndex + 1} failed: ${
      (error as Error).message
    }`;
    await updateRunStatus(run.id, RunStatus.FAILED, run.error_message);
    logger.error(
      `Run ${run.id} failed due to step ${stepIndex + 1} (${
        step.step_type
      }) failure: ${message}`
    );
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
     SET status = $1, completed_at = $2, error_message = $3
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

  // Update the step run in the workflow_step_runs table
  await query(
    `UPDATE workflow_step_runs 
     SET status = $1, 
         completed_at = $2, 
         output = $3, 
         error_message = $4
     WHERE id = $5 AND workflow_run_id = $6`,
    [
      status,
      completedAt,
      output ? JSON.stringify(output) : null,
      error,
      stepId,
      runId,
    ]
  );

  logger.debug(`Updated step ${stepId} status to ${status} for run ${runId}`);
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
      workflow_id: row.workflow_id,
      status: row.status,
      trigger: row.trigger,
      started_at: row.started_at,
      completed_at: row.completed_at,
      steps: row.steps,
      error_message: row.error_message,
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
    // First get the basic workflow run information
    const runResult = await query(`SELECT * FROM workflow_runs WHERE id = $1`, [
      runId,
    ]);

    if (runResult.rows.length === 0) {
      return null;
    }

    const runRow = runResult.rows[0];

    // Then get the step runs for this workflow run
    const stepRunsResult = await query(
      `SELECT * FROM workflow_step_runs 
       WHERE workflow_run_id = $1 
       ORDER BY id`,
      [runId]
    );

    // Map the step runs
    const stepRuns = stepRunsResult.rows.map((stepRun) => ({
      id: stepRun.id,
      workflow_run_id: stepRun.workflow_run_id,
      workflow_step_id: stepRun.workflow_step_id,
      status: stepRun.status,
      started_at: stepRun.started_at,
      completed_at: stepRun.completed_at,
      output: stepRun.output,
      error_message: stepRun.error_message,
    }));

    // Construct and return the workflow run with its step runs
    return {
      id: runRow.id,
      workflow_id: runRow.workflow_id,
      status: runRow.status,
      trigger: runRow.trigger,
      started_at: runRow.started_at,
      completed_at: runRow.completed_at,
      steps: stepRuns,
      error_message: runRow.error_message,
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
    const workflow = await workflowService.getWorkflow(run.workflow_id);
    if (!workflow) {
      throw new Error(`Workflow ${run.workflow_id} not found`);
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
