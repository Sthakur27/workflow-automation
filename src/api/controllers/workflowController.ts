import { Request, Response } from "express";
import * as workflowService from "../../services/workflowService";
import { logger } from "../../utils/logger";

export async function createWorkflow(req: Request, res: Response) {
  try {
    const { name, description, trigger_type, trigger_value, steps } = req.body;

    // Validate input
    if (!name || !description || !trigger_type || !trigger_value) {
      return res.status(400).json({
        error:
          "Missing required fields: name, description, trigger_type, and trigger_value are required",
      });
    }

    const workflow = await workflowService.createWorkflow({
      name,
      description,
      trigger_type,
      trigger_value,
      steps,
    });

    return res.status(201).json(workflow);
  } catch (error) {
    logger.error("Error in createWorkflow controller:", error);
    return res.status(500).json({
      error: "An error occurred while creating the workflow",
    });
  }
}

export async function listWorkflows(req: Request, res: Response) {
  try {
    const workflows = await workflowService.listWorkflows();
    return res.status(200).json(workflows);
  } catch (error) {
    logger.error("Error in listWorkflows controller:", error);
    return res.status(500).json({
      error: "An error occurred while listing workflows",
    });
  }
}

export async function getWorkflow(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Validate id is a number
    const workflowId = parseInt(id, 10);
    if (isNaN(workflowId)) {
      return res.status(400).json({ error: "Invalid workflow ID" });
    }

    const workflow = await workflowService.getWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    return res.status(200).json(workflow);
  } catch (error) {
    logger.error(
      `Error in getWorkflow controller for ID ${req.params.id}:`,
      error
    );
    return res.status(500).json({
      error: "An error occurred while retrieving the workflow",
    });
  }
}

export default {
  createWorkflow,
  listWorkflows,
  getWorkflow,
};
