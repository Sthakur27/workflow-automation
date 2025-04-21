import express from "express";
import workflowController from "./controllers/workflowController";
import executionController from "./controllers/executionController";

const router = express.Router();

// Workflow routes
router.post("/workflows", workflowController.createWorkflow);
router.get("/workflows", workflowController.listWorkflows);
router.get("/workflows/:id", workflowController.getWorkflow);

// Execution routes
router.get("/workflows/:id/runs", executionController.getWorkflowRuns);
router.get("/runs/:runId", executionController.getWorkflowRun);
router.post("/runs/:runId/retry", executionController.retryWorkflowRun);

// Trigger route - this would be more sophisticated in a production system
router.post(
  "/trigger/:triggerType/:triggerValue",
  executionController.triggerWorkflow
);

export default router;
