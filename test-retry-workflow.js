// Test script for retrying a failed workflow run
const axios = require("axios");
const { Client } = require("pg");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Import the database configuration from the application's config
const dbConfig = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "workflow_automation",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
};

// API endpoint for workflow operations
const API_BASE_URL = `http://localhost:${process.env.PORT || 4000}/api`;

// Get a workflow by name
async function getWorkflowByName(name) {
  try {
    console.log(`Getting workflow with name: ${name}...`);
    const response = await axios.get(`${API_BASE_URL}/workflows/name/${name}`);
    console.log("Workflow retrieved successfully!");

    // Log the number of steps to help with debugging
    const workflow = response.data;
    console.log(`Workflow has ${workflow.steps?.length || 0} steps`);

    return workflow;
  } catch (error) {
    console.error(
      "Error retrieving workflow:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Create a failed workflow run in the database
async function createFailedWorkflowRun(workflow) {
  const client = new Client(dbConfig);
  let runId = null;

  try {
    await client.connect();
    console.log("Connected to database");

    // Start a transaction
    await client.query("BEGIN");

    // Create a failed workflow run
    const runId = uuidv4();
    console.log(`Creating failed workflow run with ID: ${runId}`);

    await client.query(
      `INSERT INTO workflow_runs (id, workflow_id, status, started_at, completed_at, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        runId,
        workflow.id,
        "FAILED",
        new Date(),
        new Date(),
        "Simulated failure for testing retry functionality",
      ]
    );

    // Create step runs - make the first step successful and the second step failed
    if (workflow.steps && workflow.steps.length > 0) {
      // First step - completed successfully
      if (workflow.steps.length >= 1) {
        const firstStepId = uuidv4();
        await client.query(
          `INSERT INTO workflow_step_runs (id, workflow_run_id, workflow_step_id, status, started_at, completed_at, output)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            firstStepId,
            runId,
            workflow.steps[0].id,
            "COMPLETED",
            new Date(Date.now() - 60000), // Started 1 minute ago
            new Date(Date.now() - 55000), // Completed 55 seconds ago
            JSON.stringify({
              success: true,
              data: { message: "Step completed successfully" },
            }),
          ]
        );
        console.log(`Created successful step run for step 1`);
      }

      // Second step - failed
      if (workflow.steps.length >= 2) {
        const secondStepId = uuidv4();
        await client.query(
          `INSERT INTO workflow_step_runs (id, workflow_run_id, workflow_step_id, status, started_at, completed_at, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            secondStepId,
            runId,
            workflow.steps[1].id,
            "FAILED",
            new Date(Date.now() - 50000), // Started 50 seconds ago
            new Date(Date.now() - 45000), // Failed 45 seconds ago
            "Simulated step failure for testing retry functionality",
          ]
        );
        console.log(`Created failed step run for step 2`);
      }

      // Remaining steps - not started
      for (let i = 2; i < workflow.steps.length; i++) {
        const stepId = uuidv4();
        await client.query(
          `INSERT INTO workflow_step_runs (id, workflow_run_id, workflow_step_id, status, started_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [stepId, runId, workflow.steps[i].id, "PENDING", null]
        );
        console.log(`Created pending step run for step ${i + 1}`);
      }
    }

    // Commit the transaction
    await client.query("COMMIT");
    console.log("Failed workflow run created successfully");

    return runId;
  } catch (error) {
    // Rollback the transaction in case of error
    await client.query("ROLLBACK");
    console.error("Error creating failed workflow run:", error);
    throw error;
  } finally {
    await client.end();
    console.log("Database connection closed");
  }
}

// Retry a failed workflow run
async function retryWorkflowRun(runId) {
  try {
    console.log(`Retrying workflow run with ID: ${runId}...`);
    const response = await axios.post(`${API_BASE_URL}/runs/${runId}/retry`);
    console.log("Workflow retry initiated successfully!");
    return response.data;
  } catch (error) {
    console.error(
      "Error retrying workflow run:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Check the status of a workflow run
async function checkRunStatus(runId) {
  try {
    console.log(`Checking status of run ${runId}...`);
    const response = await axios.get(`${API_BASE_URL}/runs/${runId}`);
    const run = response.data;

    console.log(`Run status: ${run.status}`);

    if (run.steps && run.steps.length > 0) {
      console.log("\nStep results:");
      run.steps.forEach((step, index) => {
        console.log(`\nStep ${index + 1}:`);
        console.log(`Status: ${step.status}`);

        if (step.output) {
          console.log(
            "Output:",
            typeof step.output === "string"
              ? step.output
              : JSON.stringify(step.output, null, 2)
          );
        }

        if (step.error_message) {
          console.log("Error:", step.error_message);
        }
      });
    }

    return run;
  } catch (error) {
    console.error(
      "Error checking run status:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Main function to run the test
async function runTest() {
  try {
    // Workflow name to test - use a workflow that exists in your system
    const workflowName = "Purchase Order Notification";

    // Get the workflow by name
    const workflow = await getWorkflowByName(workflowName);
    console.log(`\nWorkflow found:`);
    console.log(`ID: ${workflow.id}`);
    console.log(`Name: ${workflow.name}`);
    console.log(`Trigger Type: ${workflow.trigger_type}`);
    console.log(`Trigger Value: ${workflow.trigger_value}`);

    // Create a failed workflow run
    const failedRunId = await createFailedWorkflowRun(workflow);
    console.log(`\nCreated failed workflow run with ID: ${failedRunId}`);

    // Check the status of the failed run
    console.log("\nChecking status of the failed run:");
    const failedRunStatus = await checkRunStatus(failedRunId);

    console.log("\n=== FAILED WORKFLOW RUN SUMMARY ===");
    console.log(`Status: ${failedRunStatus.status}`);
    console.log(
      `Started: ${new Date(failedRunStatus.started_at).toLocaleString()}`
    );
    if (failedRunStatus.completed_at) {
      console.log(
        `Completed: ${new Date(failedRunStatus.completed_at).toLocaleString()}`
      );
    }
    if (failedRunStatus.error_message) {
      console.log(`Error: ${failedRunStatus.error_message}`);
    }

    // Retry the failed workflow run
    console.log("\nRetrying the failed workflow run...");
    const retryResponse = await retryWorkflowRun(failedRunId);

    console.log(retryResponse);

    if (retryResponse && retryResponse.id) {
      console.log(`\nRetry initiated! New Run ID: ${retryResponse.id}`);

      // Wait for the retry to complete
      console.log("\nWaiting for retry execution to complete (3 seconds)...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check the status of the retry
      const retryStatus = await checkRunStatus(retryResponse.id);

      console.log("\n=== RETRY WORKFLOW RUN SUMMARY ===");
      console.log(`Status: ${retryStatus.status}`);
      console.log(
        `Started: ${new Date(retryStatus.started_at).toLocaleString()}`
      );
      if (retryStatus.completed_at) {
        console.log(
          `Completed: ${new Date(retryStatus.completed_at).toLocaleString()}`
        );
      }
      if (retryStatus.error_message) {
        console.log(`Error: ${retryStatus.error_message}`);
      }

      // Verify that the retry is linked to the original run
      console.log(`\nVerifying retry relationship:`);
      console.log(`Original Run ID: ${failedRunId}`);
      console.log(`Retry Run ID: ${retryResponse.id}`);
      console.log(`Retry of: ${retryStatus.retry_of || "Not set"}`);

      if (retryStatus.retry_of === failedRunId) {
        console.log(
          "\n✅ SUCCESS: Retry is properly linked to the original failed run"
        );
      } else {
        console.log(
          "\n❌ ERROR: Retry is not properly linked to the original failed run"
        );
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
runTest();
