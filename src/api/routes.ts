import express from "express";
import workflowController from "./controllers/workflowController";
import runController from "./controllers/runController";

const router = express.Router();

// Workflow management
router.post("/workflows", workflowController.createWorkflow);
router.get("/workflows", workflowController.listWorkflows);
// Note: The order of routes is important - more specific routes must come before generic ones
router.get("/workflows/name/:name", workflowController.getWorkflowByName);
router.get("/workflows/:id", workflowController.getWorkflow);
router.get("/workflows/:id/runs", runController.getWorkflowRuns);

// Workflow run execution + retry
router.get("/runs/:runId", runController.getWorkflowRun);
router.post("/runs/:runId/retry", runController.retryWorkflowRun);

// Manual trigger
router.post(
  "/trigger/:triggerType/:triggerValue",
  runController.triggerWorkflow
);

export default router;
