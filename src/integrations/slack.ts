import { logger } from "../utils/logger";
import { Integration, IntegrationResult } from "./types";

// Slack integration
export interface SlackConfig {
  channel: string;
  message: string;
  attachments?: any[];
}

export interface SlackResult extends IntegrationResult {
  timestamp: string;
}

export class SlackIntegration implements Integration<SlackConfig, SlackResult> {
  async execute(config: SlackConfig): Promise<SlackResult> {
    logger.info(
      `MOCK: Sending Slack message to channel ${config.channel}: "${config.message}"`
    );
    return { success: true, timestamp: new Date().toISOString() };
  }
}
