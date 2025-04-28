import { logger } from "../utils/logger";
import * as claudeService from "./claudeService";
import { WorkflowStep } from "../models/workflowStep";

/**
 * Interface for the workflow configuration inferred from natural language
 */
export interface InferredWorkflowConfig {
  description: string; // Extracted description of the workflow
  trigger_type: string;
  trigger_value: string;
  trigger_description: string;
  steps: Array<{
    step_type: string;
    step_config: any;
    step_order: number;
    description: string;
  }>;
}

/**
 * Infer workflow configuration from a natural language description using Claude
 * 
 * @param description The natural language description of the workflow
 * @param workflowName The name of the workflow (for context)
 * @returns Inferred workflow configuration
 */
export async function inferWorkflowConfig(
  description: string,
  workflowName: string
): Promise<InferredWorkflowConfig> {
  try {
    logger.info(`Inferring workflow configuration from description: "${description}"`);

    const prompt = `
You are a workflow automation expert. Parse the following natural language description and convert it into a structured workflow configuration.

Workflow Name: ${workflowName}
Natural Language Description: ${description}

Based on this description, determine:
1. A concise technical description of the workflow (1-2 sentences)
2. The trigger type and value that should start this workflow
3. The sequence of steps needed to accomplish this workflow

Available trigger types:
- "manual" - Triggered manually by a user
- "schedule" - Triggered on a schedule (use cron syntax for the value)
- "webhook" - Triggered by an HTTP webhook (use a path for the value)
- "email" - Triggered by receiving an email (use an email address for the value)

Available step types:
- "email" - Send an email (requires: to, subject, body)
- "slack" - Send a Slack message (requires: channel, message)
- "http" - Make an HTTP request (requires: method, url, optional: headers, body)
- "log" - Log a message (requires: message, optional: level)
- "claude" - Use Claude AI to generate content (requires: prompt, optional: model)

Return your response in the following JSON format:
{
  "description": "concise technical description of the workflow",
  "trigger_type": "one of the available trigger types",
  "trigger_value": "appropriate value for the trigger type",
  "trigger_description": "human-readable description of the trigger",
  "steps": [
    {
      "step_type": "one of the available step types",
      "step_config": {
        // configuration specific to the step type
      },
      "step_order": 1,
      "description": "human-readable description of what this step does"
    }
    // additional steps as needed
  ]
}
`;

    const response = await claudeService.generateResponse(prompt);
    
    // Extract JSON from the response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from Claude response");
    }
    
    const jsonStr = jsonMatch[0];
    const parsedConfig = JSON.parse(jsonStr) as InferredWorkflowConfig;
    
    // Validate the parsed configuration
    if (!parsedConfig.description || !parsedConfig.trigger_type || !parsedConfig.trigger_value || !Array.isArray(parsedConfig.steps)) {
      throw new Error("Invalid workflow configuration format");
    }
    
    return parsedConfig;
  } catch (error) {
    logger.error("Error inferring workflow configuration:", error);
    throw new Error(`Failed to infer workflow configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}
