import { Request, Response } from "express";
import * as workflowService from "../../services/workflowService";
import { logger } from "../../utils/logger";

export async function createWorkflow(req: Request, res: Response) {
  try {
    const { name, natural_language_description } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({
        error: "Missing required field: name is required",
      });
    }

    // Natural language description is now the preferred way to create workflows
    // If neither natural_language_description nor trigger details are provided, return an error
    if (!natural_language_description) {
      return res.status(400).json({
        error: "A natural language description of the workflow is required",
      });
    }

    const workflowResponse = await workflowService.createWorkflow({
      name,
      natural_language_description,
    });

    return res.status(201).json(workflowResponse);
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

    // Validate id is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res
        .status(400)
        .json({ error: "Invalid workflow ID format. Must be a valid UUID." });
    }

    const workflow = await workflowService.getWorkflow(id);

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
