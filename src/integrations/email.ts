import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { Integration, IntegrationResult } from "./types";

// Email integration
export interface EmailConfig {
  to: string;
  subject: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailResult extends IntegrationResult {
  messageId: string;
}

export class EmailIntegration implements Integration<EmailConfig, EmailResult> {
  async execute(config: EmailConfig): Promise<EmailResult> {
    logger.info(
      `MOCK: Sending email to ${config.to} with subject "${config.subject}"`
    );
    return { success: true, messageId: uuidv4() };
  }
}
