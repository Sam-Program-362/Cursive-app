"use client";

/**
 * Bring-your-own-key AI assistant.
 *
 * Requests go straight from the device to the provider — there is no Cursive
 * server in the APK. The active connection (see `lib/ai-connections.ts`) supplies
 * the base URL, model and API key. The system prompt and optional project
 * context come from Settings > AI (see `lib/ai-context.ts`).
 */

import { generateSmartCodeAssistance, type AIAction } from "./ai-fallback";
import {
  chatWithConnection,
  getActiveConnection,
  getPreset,
  hasConnectionKey,
  migrateLegacyConfig,
  type ChatMessage,
} from "./ai-connections";
import { DEFAULT_SYSTEM_PROMPT, loadAiSettings } from "./ai-context";

export { DEFAULT_SYSTEM_PROMPT };

export interface AiConfig {
  provider: string;
  model: string;
  hasKey: boolean;
}

export interface AiResult {
  result: string;
  engine: string;
  usedFallback: boolean;
}

export async function getAiConfig(): Promise<AiConfig> {
  await migrateLegacyConfig();
  const connection = await getActiveConnection();
  if (!connection) return { provider: "none", model: "", hasKey: false };
  return {
    provider: connection.provider,
    model: connection.model,
    hasKey: await hasConnectionKey(connection.id),
  };
}

export function buildAiPrompt(
  action: string,
  language: string,
  code: string,
  prompt?: string
): string {
  switch (action) {
    case "complete":
      return `Language: ${language}\n\nContext code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nTask: ${
        prompt || "Suggest the next logical lines of code to continue the snippet."
      }`;
    case "explain":
      return `Language: ${language}\n\nCode to explain:\n\`\`\`${language}\n${code}\n\`\`\`\n\nExplain clearly what this code does, step by step, and note any edge cases or performance characteristics.`;
    case "fix":
      return `Language: ${language}\n\nCode with potential bugs or issues:\n\`\`\`${language}\n${code}\n\`\`\`\n\nTask: Identify and fix any syntax errors, logical bugs, or performance issues. Provide the corrected code with brief comments.`;
    case "refactor":
      return `Language: ${language}\n\nCode to refactor:\n\`\`\`${language}\n${code}\n\`\`\`\n\nTask: Refactor this code for maximum readability, modern idiomatic standards, and best practices.`;
    case "custom":
    default:
      return `Language: ${language}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nRequest: ${prompt}`;
  }
}

/** The instruction part of a request, without any code (code lives in context). */
function taskPhrase(action: string, prompt?: string): string {
  switch (action) {
    case "explain":
      return "Explain clearly what this code does, step by step, and note any edge cases or performance characteristics.";
    case "fix":
      return "Identify and fix any syntax errors or logical bugs, and explain the fix briefly.";
    case "refactor":
      return "Refactor this code for maximum readability and modern, idiomatic style.";
    case "complete":
      return (
        prompt ||
        "Suggest the next logical lines of code, and explain them briefly."
      );
    case "custom":
    default:
      return prompt || "Help me with this code.";
  }
}

export interface AiRequestOptions {
  /** Overrides the saved system prompt (Settings > AI). */
  systemPrompt?: string;
  /**
   * Pre-built project context block (Settings > AI project access). When set,
   * the code is already inside it, so the action prompt contains only the task.
   */
  contextText?: string;
}

/**
 * Generate assistance using the active connection, or the built-in offline
 * assistant when no connection/key is set.
 */
export async function generateAiAssistance(
  action: AIAction | "custom",
  language: string,
  code: string,
  prompt: string,
  options: AiRequestOptions = {}
): Promise<AiResult> {
  const connection = await getActiveConnection();

  if (!connection || !(await hasConnectionKey(connection.id))) {
    return {
      result: generateSmartCodeAssistance(action, language, code, prompt),
      engine: "Built-in assistant (offline)",
      usedFallback: true,
    };
  }

  const settings = loadAiSettings();
  const systemPrompt =
    options.systemPrompt?.trim() || settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const task = taskPhrase(action, prompt);
  const userContent = options.contextText
    ? `${options.contextText}\n\n## Your task\n${task}`
    : buildAiPrompt(action, language, code, prompt);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const result = await chatWithConnection(connection, messages);
  const preset = getPreset(connection.provider);
  return {
    result,
    engine: `${connection.name || preset.label} · ${connection.model || preset.defaultModel}`,
    usedFallback: false,
  };
}
