import { Integration, IntegrationResult } from "./types";
import { EmailIntegration } from "./email";
import { SlackIntegration } from "./slack";
import { HttpIntegration } from "./http";
import { LogIntegration } from "./log";
import { ClaudeIntegration } from "./claude";
import { logger } from "../utils/logger";

// Integration registry
const integrations: Record<string, Integration<any, IntegrationResult>> = {
  email: new EmailIntegration(),
  slack: new SlackIntegration(),
  http: new HttpIntegration(),
  log: new LogIntegration(),
  claude: new ClaudeIntegration(),
};

// Execute an integration by type
async function executeIntegration(
  type: string,
  config: any
): Promise<IntegrationResult> {
  const integration = integrations[type];
  if (!integration) {
    logger.warn(`Unknown integration type: ${type}`);
    return { success: true };
  }
  return integration.execute(config);
}

// Export all integration types and the main execution function
export {
  // Main execution function
  executeIntegration,

  // Integration registry
  integrations,

  // Integration implementations
  EmailIntegration,
  SlackIntegration,
  HttpIntegration,
  LogIntegration,
  ClaudeIntegration,
};
