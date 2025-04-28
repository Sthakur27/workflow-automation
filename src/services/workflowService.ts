import { query, pool } from "../config/database";
import {
  Workflow,
  CreateWorkflowDto,
  WorkflowCreationResponse,
} from "../models/workflow";
import { logger } from "../utils/logger";
import * as nlpService from "./nlpService";
import { v4 as uuidv4 } from "uuid";

export async function createWorkflow(
  workflowData: CreateWorkflowDto
): Promise<WorkflowCreationResponse> {
  try {
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Variables to store inferred data
      let description = "";
      let triggerType = null;
      let triggerValue = null;
      let inferredData = null;

      // If natural language description is provided, use NLP to infer workflow configuration
      if (
        workflowData.natural_language_description &&
        (!triggerType || !triggerValue)
      ) {
        try {
          const inferredConfig = await nlpService.inferWorkflowConfig(
            workflowData.natural_language_description,
            workflowData.name
          );

          // Use inferred description, trigger type and value
          description = inferredConfig.description;
          triggerType = inferredConfig.trigger_type;
          triggerValue = inferredConfig.trigger_value;

          // Store inferred data for response
          inferredData = {
            trigger: {
              type: inferredConfig.trigger_type,
              value: inferredConfig.trigger_value,
              description: inferredConfig.trigger_description,
            },
            steps: inferredConfig.steps.map((step) => ({
              id: uuidv4(),
              type: step.step_type,
              config: step.step_config,
              order: step.step_order,
            })),
          };

          // The steps will be used when creating workflow steps in the database
        } catch (error) {
          logger.error("Error inferring workflow configuration:", error);
          // Fall back to default values if inference fails
          triggerType = triggerType || "manual";
          triggerValue =
            triggerValue ||
            workflowData.name.toLowerCase().replace(/\s+/g, "_");
        }
      } else {
        // Use provided values or defaults
        triggerType = triggerType || "manual";
        triggerValue =
          triggerValue || workflowData.name.toLowerCase().replace(/\s+/g, "_");
      }

      // Insert the workflow
      const workflowResult = await client.query(
        `INSERT INTO workflows (name, description, trigger_type, trigger_value)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [workflowData.name, description, triggerType, triggerValue]
      );

      const workflow = workflowResult.rows[0];
      const workflowSteps = [];

      // Insert steps from the inferred configuration
      if (inferredData && inferredData.steps && inferredData.steps.length > 0) {
        for (const step of inferredData.steps) {
          const stepResult = await client.query(
            `INSERT INTO workflow_steps (workflow_id, step_type, step_config, step_order)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [workflow.id, step.type, step.config, step.order]
          );
          workflowSteps.push(stepResult.rows[0]);
        }
      }

      await client.query("COMMIT");

      // Construct the workflow object with steps
      const createdWorkflow: Workflow = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        trigger_type: workflow.trigger_type,
        trigger_value: workflow.trigger_value,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
        steps: workflowSteps.map((step) => ({
          id: step.id,
          workflow_id: step.workflow_id,
          step_type: step.step_type,
          step_config: step.step_config,
          step_order: step.step_order,
          created_at: step.created_at,
          updated_at: step.updated_at,
        })),
      };

      // Create the structured response
      const response: WorkflowCreationResponse = {
        workflow: createdWorkflow,
        inferred_data: inferredData || {
          trigger: {
            type: workflow.trigger_type,
            value: workflow.trigger_value,
            description: `Workflow will be triggered when ${workflow.trigger_type} event with value '${workflow.trigger_value}' occurs`,
          },
          steps: workflowSteps.map((step) => ({
            id: step.id,
            type: step.step_type,
            config: step.step_config,
            order: step.step_order,
          })),
        },
        metadata: {
          created_at: workflow.created_at,
          updated_at: workflow.updated_at,
          execution_estimate: estimateExecutionTime(workflowSteps),
        },
      };

      return response;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("Error creating workflow:", error);
    throw error;
  }
}

export async function listWorkflows(): Promise<Workflow[]> {
  try {
    const result = await query(
      "SELECT * FROM workflows ORDER BY created_at DESC"
    );

    const workflows: Workflow[] = [];
    for (const row of result.rows) {
      const workflow: Workflow = {
        id: row.id,
        name: row.name,
        description: row.description,
        trigger_type: row.trigger_type,
        trigger_value: row.trigger_value,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      // Get steps for this workflow
      const stepsResult = await query(
        "SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order",
        [workflow.id]
      );

      workflow.steps = stepsResult.rows.map((step) => ({
        id: step.id,
        workflow_id: step.workflow_id,
        step_type: step.step_type,
        step_config: step.step_config,
        step_order: step.step_order,
        created_at: step.created_at,
        updated_at: step.updated_at,
      }));

      workflows.push(workflow);
    }

    return workflows;
  } catch (error) {
    logger.error("Error listing workflows:", error);
    throw error;
  }
}

function estimateExecutionTime(steps: any[]): string {
  // Simple estimation based on step types
  // In a real system, this would be more sophisticated
  const baseTime = 500; // Base time in ms
  let totalTime = baseTime;

  for (const step of steps) {
    switch (step.step_type) {
      case "email":
        totalTime += 1000; // Email typically takes ~1s
        break;
      case "slack":
        totalTime += 800; // Slack message ~800ms
        break;
      case "http":
        totalTime += 1500; // HTTP requests ~1.5s
        break;
      case "log":
        totalTime += 100; // Logging is fast ~100ms
        break;
      default:
        totalTime += 500; // Default for unknown types
    }
  }

  // Format the time estimate
  if (totalTime < 1000) {
    return `${totalTime}ms`;
  } else if (totalTime < 60000) {
    return `${(totalTime / 1000).toFixed(1)}s`;
  } else {
    return `${(totalTime / 60000).toFixed(1)}m`;
  }
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const result = await query("SELECT * FROM workflows WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const workflow: Workflow = {
      id: row.id,
      name: row.name,
      description: row.description,
      trigger_type: row.trigger_type,
      trigger_value: row.trigger_value,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Get steps for this workflow
    const stepsResult = await query(
      "SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order",
      [workflow.id]
    );

    workflow.steps = stepsResult.rows.map((step) => ({
      id: step.id,
      workflow_id: step.workflow_id,
      step_type: step.step_type,
      step_config: step.step_config,
      step_order: step.step_order,
      created_at: step.created_at,
      updated_at: step.updated_at,
    }));

    return workflow;
  } catch (error) {
    logger.error(`Error getting workflow with ID ${id}:`, error);
    throw error;
  }
}

export default {
  createWorkflow,
  listWorkflows,
  getWorkflow,
};
