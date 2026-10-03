"use client";

/**
 * Bring-your-own-key AI assistant.
 *
 * The user picks a provider and pastes their own API key (stored encrypted via
 * the secret store). Requests go straight from the device to the provider —
 * there is no Cursive server in the APK. When no key is configured the editor
 * falls back to the built-in offline assistant so the feature still works.
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getSecret, setSecret, removeSecret } from "./secrets";
import { generateSmartCodeAssistance, type AIAction } from "./ai-fallback";

export type AiProvider = "openai" | "anthropic" | "google";

export interface AiProviderMeta {
  id: AiProvider;
  label: string;
  keyPlaceholder: string;
  defaultModel: string;
  docsUrl: string;
  note: string;
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI (GPT)",
    keyPlaceholder: "sk-proj-...",
    defaultModel: "gpt-4o-mini",
    docsUrl: "https://platform.openai.com/api-keys",
    note: "Create an API key in your OpenAI dashboard. Billing may be required.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyPlaceholder: "sk-ant-...",
    defaultModel: "claude-3-5-sonnet-20241022",
    docsUrl: "https://console.anthropic.com/settings/keys",
    note: "Create an API key in the Anthropic Console.",
  },
  {
    id: "google",
    label: "Google (Gemini)",
    keyPlaceholder: "AIza...",
    defaultModel: "gemini-1.5-flash",
    docsUrl: "https://aistudio.google.com/app/apikey",
    note: "Gemini has a free tier, which makes it a good starting point.",
  },
];

export interface AiConfig {
  provider: AiProvider;
  model: string;
  hasKey: boolean;
}

export interface AiResult {
  result: string;
  engine: string;
  usedFallback: boolean;
}

const PROVIDER_KEY = "cursive_ai_provider";
const MODEL_KEY = "cursive_ai_model";
const SECRET_PREFIX = "cursive_ai_key_";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getProviderMeta(provider: AiProvider): AiProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];
}

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export async function getAiConfig(): Promise<AiConfig> {
  const provider = (readLocal(PROVIDER_KEY) as AiProvider) || "openai";
  const model = readLocal(MODEL_KEY) || getProviderMeta(provider).defaultModel;
  const key = await getSecret(`${SECRET_PREFIX}${provider}`);
  return { provider, model, hasKey: Boolean(key && key.trim()) };
}

export async function saveAiConfig(config: {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
}): Promise<void> {
  writeLocal(PROVIDER_KEY, config.provider);
  if (config.model !== undefined) writeLocal(MODEL_KEY, config.model);
  if (config.apiKey !== undefined && config.apiKey.trim()) {
    await setSecret(`${SECRET_PREFIX}${config.provider}`, config.apiKey.trim());
  }
}

export async function clearAiKey(provider: AiProvider): Promise<void> {
  await removeSecret(`${SECRET_PREFIX}${provider}`);
}

/* ------------------------------------------------------------------ */
/* Prompt + provider calls                                             */
/* ------------------------------------------------------------------ */

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

const SYSTEM_PROMPT =
  "You are an expert programming assistant inside the Cursive code editor. Provide clean, precise, and immediately useful code or explanations. When asked for code, prefer returning just the code with minimal commentary.";

interface HttpResult {
  status: number;
  text: string;
}

async function httpPost(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<HttpResult> {
  const allHeaders = { "Content-Type": "application/json", ...headers };

  if (isNative()) {
    const response = await CapacitorHttp.request({
      url,
      method: "POST",
      headers: allHeaders,
      data: body,
      responseType: "text",
    });
    return {
      status: response.status,
      text:
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data ?? ""),
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: allHeaders,
    body: JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function friendlyAiError(status: number, parsed: any, provider: AiProvider): string {
  const label = getProviderMeta(provider).label;
  const message =
    parsed?.error?.message || parsed?.message || parsed?.error || "";
  if (status === 401 || status === 403) {
    return `${label} rejected the API key (${status}). Check the key hasn't expired and that it's pasted correctly.`;
  }
  if (status === 429) {
    return `${label} rate limit or quota reached (429). Wait a moment or check your billing/quota.`;
  }
  if (status >= 500) {
    return `${label} had a server error (${status}). Try again shortly.`;
  }
  return typeof message === "string" && message
    ? `${label}: ${message}`
    : `${label} returned HTTP ${status}.`;
}

async function callProvider(
  provider: AiProvider,
  apiKey: string,
  model: string,
  action: string,
  language: string,
  code: string,
  prompt: string
): Promise<string> {
  const userContent = buildAiPrompt(action, language, code, prompt);

  let url = "";
  let headers: Record<string, string> = {};
  let body: unknown;

  if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey}` };
    body = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required for direct browser calls; harmless on device.
      "anthropic-dangerous-direct-browser-access": "true",
    };
    body = {
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    headers = {};
    body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
    };
  }

  let response: HttpResult;
  try {
    response = await httpPost(url, headers, body);
  } catch {
    throw new Error("Couldn't reach the AI provider. Check your internet connection.");
  }

  const parsed = parseJson(response.text);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(friendlyAiError(response.status, parsed, provider));
  }

  if (provider === "openai") {
    const text = parsed?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) return text.trim();
  } else if (provider === "anthropic") {
    const text = parsed?.content?.[0]?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  } else {
    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }

  throw new Error("The AI provider returned an empty response.");
}

/**
 * Generate assistance using the configured provider, or the built-in offline
 * assistant when no key is set.
 */
export async function generateAiAssistance(
  action: AIAction | "custom",
  language: string,
  code: string,
  prompt: string
): Promise<AiResult> {
  const config = await getAiConfig();

  if (!config.hasKey) {
    return {
      result: generateSmartCodeAssistance(action, language, code, prompt),
      engine: "Built-in assistant (offline)",
      usedFallback: true,
    };
  }

  const apiKey = (await getSecret(`${SECRET_PREFIX}${config.provider}`)) || "";
  const model = config.model || getProviderMeta(config.provider).defaultModel;
  const result = await callProvider(
    config.provider,
    apiKey,
    model,
    action,
    language,
    code,
    prompt
  );

  return {
    result,
    engine: `${getProviderMeta(config.provider).label} · ${model}`,
    usedFallback: false,
  };
}
