// Test script for workflow execution using the Claude integration
const axios = require("axios");

// API endpoint for executing workflows
const API_BASE_URL = "http://localhost:4000/api";

// Get a workflow by name
async function getWorkflowByName(name) {
  try {
    console.log(`Getting workflow with name: ${name}...`);

    // Use the direct endpoint to get workflow by name
    const response = await axios.get(`${API_BASE_URL}/workflows/name/${name}`);
    console.log("Workflow retrieved successfully!");
    
    // Log the number of steps to help with debugging
    const workflow = response.data;
    console.log(`Workflow has ${workflow.steps?.length || 0} steps`);
    
    if (!workflow.steps || workflow.steps.length === 0) {
      console.warn("Warning: Workflow has no steps. This may cause issues during execution.");
    }

    return workflow;
  } catch (error) {
    console.error(
      "Error retrieving workflow:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Then, trigger the workflow manually
async function triggerWorkflow(workflow) {
  try {
    console.log(`Triggering workflow ${workflow.id}...`);

    const triggerType = workflow.trigger_type;
    const triggerValue = workflow.trigger_value;

    console.log(`Trigger type: ${triggerType}, Trigger value: ${triggerValue}`);

    // Construct the trigger URL based on the trigger type
    let triggerUrl;
    if (triggerType === "webhook") {
      // For webhook triggers, construct the URL properly
      triggerUrl = `${API_BASE_URL}/trigger/webhook/${triggerValue}`;
    } else {
      triggerUrl = `${API_BASE_URL}/trigger/${triggerType}/${triggerValue}`;
    }

    console.log(`Trigger URL: ${triggerUrl}`);
    // No trigger data is supported yet, so send an empty object
    const response = await axios.post(triggerUrl, {});

    console.log("Workflow triggered successfully!");
    return response.data;
  } catch (error) {
    console.error(
      "Error triggering workflow:",
      error.response?.data || error.message
    );
    // Return null instead of throwing to allow fallback logic
    return null;
  }
}

// Check the status of the workflow run
async function checkRunStatus(runId) {
  try {
    console.log(`Checking status of run ${runId}...`);

    const response = await axios.get(`${API_BASE_URL}/runs/${runId}`);
    const run = response.data;

    console.log(`Run status: ${run.status}`);

    if (run.step_runs && run.step_runs.length > 0) {
      console.log("\nStep results:");
      run.step_runs.forEach((stepRun, index) => {
        console.log(`\nStep ${index + 1} (${stepRun.step_type}):`);
        console.log(`Status: ${stepRun.status}`);

        if (stepRun.output) {
          try {
            const output =
              typeof stepRun.output === "string"
                ? JSON.parse(stepRun.output)
                : stepRun.output;

            if (stepRun.step_type === "claude" && output.response) {
              console.log("\nClaude Response:");
              console.log(output.response);
            } else {
              console.log("\nOutput:");
              console.log(JSON.stringify(output, null, 2));
            }
          } catch (e) {
            console.log("\nOutput:");
            console.log(stepRun.output);
          }
        }

        if (stepRun.error) {
          console.log("\nError:");
          console.log(stepRun.error);
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
    // Workflow name to test
    const workflowName = "Purchase Order Notification";

    // Get the workflow by name
    const workflow = await getWorkflowByName(workflowName);
    console.log(`\nWorkflow found:`);
    console.log(`ID: ${workflow.id}`);
    console.log(`Name: ${workflow.name}`);
    console.log(`Trigger Type: ${workflow.trigger_type}`);
    console.log(`Trigger Value: ${workflow.trigger_value}`);

    // Trigger the workflow
    const triggerResponse = await triggerWorkflow(workflow);
    
    if (triggerResponse && triggerResponse.run_id) {
      console.log(`\nRun ID: ${triggerResponse.run_id}`);
      
      // Wait longer for the workflow to execute (30 seconds)
      console.log("\nWaiting for workflow to execute (30 seconds)...");
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check the status of the run
      const runStatus = await checkRunStatus(triggerResponse.run_id);
      
      console.log("\n=== WORKFLOW EXECUTION SUMMARY ===");
      console.log(`Status: ${runStatus.status}`);
      console.log(`Started: ${new Date(runStatus.started_at).toLocaleString()}`);
      if (runStatus.completed_at) {
        console.log(`Completed: ${new Date(runStatus.completed_at).toLocaleString()}`);
      }
      if (runStatus.error_message) {
        console.log(`Error: ${runStatus.error_message}`);
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
runTest();
