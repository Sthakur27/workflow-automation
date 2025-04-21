import { Request, Response } from "express";
import * as runService from "../../services/runService";
import { logger } from "../../utils/logger";

export async function getWorkflowRuns(req: Request, res: Response) {
  try {
    const { id } = req.params; // workflow id

    // Validate id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid workflow ID format. Must be a valid UUID." });
    }

    const runs = await runService.getWorkflowRuns(id);

    return res.status(200).json(runs);
  } catch (error) {
    logger.error(
      `Error in getWorkflowRuns controller for workflow ID ${req.params.id}:`,
      error
    );
    return res.status(500).json({
      error: "An error occurred while retrieving workflow runs",
    });
  }
}

export async function getWorkflowRun(req: Request, res: Response) {
  try {
    const { runId } = req.params;

    // Validate runId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(runId)) {
      return res.status(400).json({ error: "Invalid run ID format. Must be a valid UUID." });
    }

    const run = await runService.getWorkflowRun(runId);

    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }

    return res.status(200).json(run);
  } catch (error) {
    logger.error(
      `Error in getWorkflowRun controller for run ID ${req.params.runId}:`,
      error
    );
    return res.status(500).json({
      error: "An error occurred while retrieving the run",
    });
  }
}

export async function retryWorkflowRun(req: Request, res: Response) {
  try {
    const { runId } = req.params;

    // Validate runId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(runId)) {
      return res.status(400).json({ error: "Invalid run ID format. Must be a valid UUID." });
    }

    const newRun = await runService.retryWorkflowRun(runId);

    if (!newRun) {
      return res.status(404).json({ error: "Run not found" });
    }

    return res.status(201).json(newRun);
  } catch (error) {
    logger.error(
      `Error in retryWorkflowRun controller for run ID ${req.params.runId}:`,
      error
    );
    return res.status(500).json({
      error: "An error occurred while retrying the run",
    });
  }
}

export async function triggerWorkflow(req: Request, res: Response) {
  try {
    const { triggerType, triggerValue } = req.params;

    const run = await runService.triggerWorkflow(triggerType, triggerValue);

    if (!run) {
      return res.status(404).json({
        error: `No workflow found for trigger type ${triggerType} and value ${triggerValue}`,
      });
    }

    return res.status(201).json(run);
  } catch (error) {
    logger.error(
      `Error in triggerWorkflow controller for trigger ${req.params.triggerType}:${req.params.triggerValue}:`,
      error
    );
    return res.status(500).json({
      error: "An error occurred while triggering the workflow",
    });
  }
}

export default {
  getWorkflowRuns,
  getWorkflowRun,
  retryWorkflowRun,
  triggerWorkflow,
};
