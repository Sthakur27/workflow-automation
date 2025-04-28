import { Anthropic } from "@anthropic-ai/sdk";
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
  model: string = "claude-3-5-sonnet-latest"
): Promise<ClaudeResponse> {
  try {
    const allMessages: ClaudeMessage[] = [
      ...messages,
      { role: "user", content: prompt },
    ];

    const response = await anthropic.messages.create({
      model,
      messages: allMessages,
      max_tokens: 4000,
    });
    // Extract text content from the response
    let content = "";
    if (response.content && response.content.length > 0) {
      const block = response.content[0];
      if ("text" in block) {
        content = block.text;
      }
    }

    return {
      content,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
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
