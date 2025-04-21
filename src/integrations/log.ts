import { logger } from "../utils/logger";
import { Integration, IntegrationResult } from "./types";

// Log integration
export interface LogConfig {
  message: string;
  level?: "info" | "warn" | "error";
}

export interface LogResult extends IntegrationResult {}

export class LogIntegration implements Integration<LogConfig, LogResult> {
  async execute(config: LogConfig): Promise<LogResult> {
    const level = config.level || "info";
    
    switch (level) {
      case "warn":
        logger.warn(`WORKFLOW LOG: ${config.message}`);
        break;
      case "error":
        logger.error(`WORKFLOW LOG: ${config.message}`);
        break;
      default:
        logger.info(`WORKFLOW LOG: ${config.message}`);
    }
    
    return { success: true };
  }
}
