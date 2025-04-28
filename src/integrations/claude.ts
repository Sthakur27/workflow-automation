import { logger } from "../utils/logger";
import { Integration, IntegrationResult } from "./types";
import * as claudeService from "../services/claudeService";

// Claude integration
export interface ClaudeConfig {
  prompt: string;
  model?: string;
  messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface ClaudeResult extends IntegrationResult {
  response: string;
  model: string;
}

export class ClaudeIntegration implements Integration<ClaudeConfig, ClaudeResult> {
  async execute(config: ClaudeConfig): Promise<ClaudeResult> {
    logger.info(
      `CLAUDE: Generating response for prompt: "${config.prompt.substring(0, 50)}${config.prompt.length > 50 ? '...' : ''}"`
    );
    
    try {
      const response = await claudeService.generateResponse(
        config.prompt,
        config.messages,
        config.model
      );
      
      return { 
        success: true, 
        response: response.content,
        model: response.model
      };
    } catch (error) {
      logger.error('Error in Claude integration:', error);
      return {
        success: false,
        error: `Claude API error: ${error instanceof Error ? error.message : String(error)}`,
        response: '',
        model: ''
      };
    }
  }
}
