import { logger } from "../utils/logger";
import { Integration, IntegrationResult } from "./types";

// HTTP integration
export interface HttpConfig {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface HttpResult extends IntegrationResult {
  status: number;
  data: any;
}

export class HttpIntegration implements Integration<HttpConfig, HttpResult> {
  async execute(config: HttpConfig): Promise<HttpResult> {
    logger.info(`MOCK: Making HTTP ${config.method} request to ${config.url}`);
    return { success: true, status: 200, data: { message: "Success" } };
  }
}
