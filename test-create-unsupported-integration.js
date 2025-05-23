// Test script for workflow creation with an unsupported integration type
const axios = require("axios");

// API endpoint for creating workflows
const API_URL = "http://localhost:4000/api/workflows";

// Example workflow with natural language description that includes an unsupported integration (SMS)
const testWorkflow = {
  name: "Customer Support Ticket SMS Notification",
  natural_language_description:
    "When a high priority support ticket is created, send an SMS text message to the on-call support engineer, then post a message in the #urgent-support Slack channel with the ticket details.",
};

// Create the workflow
async function createWorkflow() {
  try {
    console.log("Creating workflow with natural language description...");
    const response = await axios.post(API_URL, testWorkflow);

    console.log("\nWorkflow created successfully!");
    console.log("\nWorkflow details:");
    console.log(`ID: ${response.data.workflow.id}`);
    console.log(`Name: ${response.data.workflow.name}`);
    console.log(`Description: ${response.data.workflow.description}`);
    console.log(`Trigger Type: ${response.data.workflow.trigger_type}`);
    console.log(`Trigger Value: ${response.data.workflow.trigger_value}`);

    console.log("\nInferred data:");
    console.log(
      `Trigger description: ${response.data.inferred_data.trigger.description}`
    );

    console.log("\nWorkflow steps:");
    response.data.inferred_data.steps.forEach((step, index) => {
      console.log(`\nStep ${index + 1}:`);
      console.log(`Type: ${step.type}`);
      console.log(`Order: ${step.order}`);
      console.log("Config:", JSON.stringify(step.config, null, 2));
    });

    console.log("\nMetadata:");
    console.log(`Created at: ${response.data.metadata.created_at}`);
    console.log(
      `Execution estimate: ${response.data.metadata.execution_estimate}`
    );

    return response.data;
  } catch (error) {
    console.error("Error creating workflow:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Response:", error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
createWorkflow();
