import express from "express";
import workflowController from "./controllers/workflowController";
import runController from "./controllers/runController";

const router = express.Router();

// Workflow management
router.post("/workflows", workflowController.createWorkflow);
router.get("/workflows", workflowController.listWorkflows);
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
