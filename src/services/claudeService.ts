import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../utils/logger";

// Load environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function generateResponse(
  prompt: string,
  messages: ClaudeMessage[] = [],
  model: string = "claude-3-sonnet-20240229"
): Promise<ClaudeResponse> {
  try {
    const allMessages: ClaudeMessage[] = [
      ...messages,
      { role: "user", content: prompt },
    ];

    const response = await anthropic.completions.create({
      model,
      prompt: `${Anthropic.HUMAN_PROMPT} ${prompt} ${Anthropic.AI_PROMPT}`,
      max_tokens_to_sample: 4000,
    });
    return {
      content: response.completion,
      model: response.model,
      usage: {
        input_tokens: 0, // Not available in completions API
        output_tokens: 0, // Not available in completions API
      },
    };
  } catch (error) {
    logger.error("Error calling Claude API:", error);
    throw new Error(
      `Failed to generate response from Claude: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
