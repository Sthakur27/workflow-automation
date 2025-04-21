import { query, pool } from "../config/database";
import { Workflow, CreateWorkflowDto } from "../models/workflow";
import { logger } from "../utils/logger";

export async function createWorkflow(
  workflowData: CreateWorkflowDto
): Promise<Workflow> {
  try {
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Insert the workflow
      const workflowResult = await client.query(
        `INSERT INTO workflows (name, description, trigger_type, trigger_value)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          workflowData.name,
          workflowData.description,
          workflowData.trigger_type,
          workflowData.trigger_value,
        ]
      );

      const workflow = workflowResult.rows[0];

      // Insert steps if provided
      if (workflowData.steps && workflowData.steps.length > 0) {
        for (const step of workflowData.steps) {
          await client.query(
            `INSERT INTO workflow_steps (workflow_id, step_type, step_config, step_order)
             VALUES ($1, $2, $3, $4)`,
            [workflow.id, step.step_type, step.step_config, step.step_order]
          );
        }
      }

      await client.query("COMMIT");

      // Return the created workflow with steps
      return await getWorkflow(workflow.id);
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
      const workflow = {
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

export async function getWorkflow(id: number): Promise<Workflow | null> {
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
