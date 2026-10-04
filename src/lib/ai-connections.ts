"use client";

/**
 * AI connections — multiple saved provider setups, like a desktop editor.
 *
 * Cursive is an offline-first app with no server, so there is no proxy: each
 * connection stores its own base URL and model, its API key lives in the
 * Keystore-backed secret store (`lib/secrets.ts`), and requests go straight
 * from the device to the provider through CapacitorHttp on Android.
 *
 * A "provider preset" only pre-fills the base URL and a starting model; the URL
 * stays editable so OpenRouter, a local server or any OpenAI-compatible service
 * can be used. Anthropic keeps its own native request/response shape.
 *
 * Base URLs below were checked against each provider's docs (Oct 2026).
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getSecret, setSecret, removeSecret } from "./secrets";

export type ProviderKind =
  | "openai"
  | "openrouter"
  | "anthropic"
  | "google"
  | "huggingface"
  | "groq"
  | "deepseek"
  | "together"
  | "mistral"
  | "local"
  | "custom";

export type ApiStyle = "openai" | "anthropic" | "google";

export interface ProviderPreset {
  id: ProviderKind;
  label: string;
  /** How requests and responses are shaped. */
  apiStyle: ApiStyle;
  /** Pre-filled API base URL (without the trailing request path). */
  baseUrl: string;
  defaultModel: string;
  keyPlaceholder: string;
  docsUrl: string;
  note: string;
  /** Headers some providers ask for (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    apiStyle: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    note: "Create a key in your OpenAI dashboard. Billing may be required.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    apiStyle: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
    note: "One key for many models. Hundreds of models are available.",
    extraHeaders: {
      "HTTP-Referer": "https://cursive.app",
      "X-Title": "Cursive",
    },
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    apiStyle: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    note: "Uses Anthropic's own API format and headers (not OpenAI-compatible).",
  },
  {
    id: "google",
    label: "Google Gemini",
    // Gemini's own API, so limits map to generationConfig.maxOutputTokens.
    apiStyle: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    note: "Gemini has a free tier, which makes it a good starting point.",
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    apiStyle: "openai",
    baseUrl: "https://router.huggingface.co/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    keyPlaceholder: "hf_...",
    docsUrl: "https://huggingface.co/settings/tokens",
    note: "Inference Providers router — one token reaches many models.",
  },
  {
    id: "groq",
    label: "Groq",
    apiStyle: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
    note: "Very fast inference with a generous free tier.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    apiStyle: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    note: "Strong coding models at low cost.",
  },
  {
    id: "together",
    label: "Together AI",
    apiStyle: "openai",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    keyPlaceholder: "...",
    docsUrl: "https://api.together.ai/settings/api-keys",
    note: "Hosted open models (Llama, Qwen, DeepSeek and more).",
  },
  {
    id: "mistral",
    label: "Mistral",
    apiStyle: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    keyPlaceholder: "...",
    docsUrl: "https://console.mistral.ai/api-keys",
    note: "Mistral's hosted models.",
  },
  {
    id: "local",
    label: "Local server (Ollama / LM Studio)",
    apiStyle: "openai",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    keyPlaceholder: "(usually not needed)",
    docsUrl: "https://docs.ollama.com/api/openai-compatibility",
    note: "Ollama uses port 11434, LM Studio uses 1234. Point this at the LAN address of the computer running the server.",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    apiStyle: "openai",
    baseUrl: "",
    defaultModel: "",
    keyPlaceholder: "your-api-key",
    docsUrl: "",
    note: "Any service that speaks the OpenAI API. Enter its base URL and model.",
  },
];

export function getPreset(kind: ProviderKind): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === kind) || PROVIDER_PRESETS[0];
}

export interface AiConnection {
  id: string;
  name: string;
  provider: ProviderKind;
  baseUrl: string;
  model: string;
  /** Optional per-connection overrides of the global token controls. */
  overrides?: Partial<TokenLimits>;
}

/**
 * Token controls. The global values live in Settings > AI (see ai-context.ts);
 * a connection may override any of them individually.
 */
export interface TokenLimits {
  /** Max response tokens, or "model" to let the provider decide. */
  maxResponseTokens: number | "model";
  /** Budget for chat history + attached project context. */
  maxContextTokens: number;
  /** Sampling temperature, or null to leave it at the provider default. */
  temperature: number | null;
}

export const DEFAULT_TOKEN_LIMITS: TokenLimits = {
  maxResponseTokens: 4096,
  maxContextTokens: 16000,
  temperature: null,
};

export const MIN_RESPONSE_TOKENS = 256;
export const MAX_RESPONSE_TOKENS = 16384;
/** Values offered in the token pickers (all within the supported range). */
export const RESPONSE_TOKEN_CHOICES = [256, 512, 1024, 2048, 4096, 8192, 16384];
/** Values offered for the context budget (history + attached project). */
export const CONTEXT_TOKEN_CHOICES = [4000, 8000, 12000, 16000, 32000, 64000, 128000];

export function clampResponseTokens(value: number): number {
  return Math.min(MAX_RESPONSE_TOKENS, Math.max(MIN_RESPONSE_TOKENS, Math.round(value)));
}

/** Per-connection override wins over the global value when it is set. */
export function resolveTokenLimits(
  connection: AiConnection | null | undefined,
  globals: TokenLimits
): TokenLimits {
  const overrides = connection?.overrides || {};
  return {
    maxResponseTokens:
      overrides.maxResponseTokens !== undefined
        ? overrides.maxResponseTokens
        : globals.maxResponseTokens,
    maxContextTokens:
      overrides.maxContextTokens !== undefined
        ? overrides.maxContextTokens
        : globals.maxContextTokens,
    temperature:
      overrides.temperature !== undefined
        ? overrides.temperature
        : globals.temperature,
  };
}

const CONNECTIONS_KEY = "cursive_ai_connections";
const ACTIVE_KEY = "cursive_ai_active_connection";
const CONNECTION_SECRET_PREFIX = "cursive_ai_conn_key_";
// Keys written by the older single-provider AI settings.
const LEGACY_PROVIDER_KEY = "cursive_ai_provider";
const LEGACY_MODEL_KEY = "cursive_ai_model";
const LEGACY_SECRET_PREFIX = "cursive_ai_key_";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
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
    /* storage full or blocked */
  }
}

function removeLocal(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function connectionSecretKey(id: string): string {
  return `${CONNECTION_SECRET_PREFIX}${id}`;
}

export function makeConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Trim a base URL and remove any trailing slashes. */
export function normalizeBaseUrl(baseUrl: string): string {
  return (baseUrl || "").trim().replace(/\/+$/, "");
}

/** Join a base URL with a request path, tolerating a trailing slash. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                          */
/* ------------------------------------------------------------------ */

export function loadConnections(): AiConnection[] {
  const raw = readLocal(CONNECTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c): c is AiConnection =>
        Boolean(c && typeof c.id === "string" && typeof c.name === "string")
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        provider: (c.provider as ProviderKind) || "custom",
        baseUrl: typeof c.baseUrl === "string" ? c.baseUrl : "",
        model: typeof c.model === "string" ? c.model : "",
        ...(c.overrides && typeof c.overrides === "object"
          ? { overrides: sanitizeOverrides(c.overrides) }
          : {}),
      }));
  } catch {
    return [];
  }
}

function sanitizeOverrides(raw: any): Partial<TokenLimits> {
  const out: Partial<TokenLimits> = {};
  if (raw.maxResponseTokens === "model") out.maxResponseTokens = "model";
  else if (typeof raw.maxResponseTokens === "number")
    out.maxResponseTokens = clampResponseTokens(raw.maxResponseTokens);
  if (typeof raw.maxContextTokens === "number" && raw.maxContextTokens > 0)
    out.maxContextTokens = Math.round(raw.maxContextTokens);
  if (raw.temperature === null) out.temperature = null;
  else if (typeof raw.temperature === "number")
    out.temperature = Math.min(2, Math.max(0, raw.temperature));
  return out;
}

export function saveConnections(connections: AiConnection[]) {
  writeLocal(CONNECTIONS_KEY, JSON.stringify(connections));
}

const TOKEN_LIMITS_KEY = "cursive_ai_token_limits";

/** Sanitise a token-limits object, filling anything missing with defaults. */
export function sanitizeTokenLimits(raw: any): TokenLimits {
  return {
    maxResponseTokens:
      raw?.maxResponseTokens === "model"
        ? "model"
        : typeof raw?.maxResponseTokens === "number"
        ? clampResponseTokens(raw.maxResponseTokens)
        : DEFAULT_TOKEN_LIMITS.maxResponseTokens,
    maxContextTokens:
      typeof raw?.maxContextTokens === "number" && raw.maxContextTokens > 0
        ? Math.min(200000, Math.round(raw.maxContextTokens))
        : DEFAULT_TOKEN_LIMITS.maxContextTokens,
    temperature:
      raw?.temperature === null
        ? null
        : typeof raw?.temperature === "number"
        ? Math.min(2, Math.max(0, raw.temperature))
        : DEFAULT_TOKEN_LIMITS.temperature,
  };
}

/** Global token controls (Settings > AI). Connections may override these. */
export function loadTokenLimits(): TokenLimits {
  const raw = readLocal(TOKEN_LIMITS_KEY);
  if (!raw) return { ...DEFAULT_TOKEN_LIMITS };
  try {
    return sanitizeTokenLimits(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TOKEN_LIMITS };
  }
}

/** Merge a patch into the stored globals (undefined fields stay untouched). */
export function saveTokenLimits(patch: Partial<TokenLimits>): void {
  const merged = { ...loadTokenLimits() };
  if (patch.maxResponseTokens !== undefined) {
    merged.maxResponseTokens = patch.maxResponseTokens;
  }
  if (patch.maxContextTokens !== undefined) {
    merged.maxContextTokens = patch.maxContextTokens;
  }
  if (patch.temperature !== undefined) merged.temperature = patch.temperature;
  writeLocal(TOKEN_LIMITS_KEY, JSON.stringify(sanitizeTokenLimits(merged)));
}

export function getActiveConnectionId(): string | null {
  return readLocal(ACTIVE_KEY);
}

export function setActiveConnectionId(id: string | null) {
  if (id) writeLocal(ACTIVE_KEY, id);
  else removeLocal(ACTIVE_KEY);
}

/**
 * Fold the old single-provider settings into a connection the first time the
 * new UI loads, so an already-saved key and provider are not lost.
 */
export async function migrateLegacyConfig(): Promise<void> {
  if (loadConnections().length > 0) return;

  const legacyProvider = readLocal(LEGACY_PROVIDER_KEY) as ProviderKind | null;
  if (!legacyProvider) return;

  const preset = getPreset(legacyProvider);
  const legacyModel = readLocal(LEGACY_MODEL_KEY) || preset.defaultModel;
  const legacyKey = await getSecret(`${LEGACY_SECRET_PREFIX}${legacyProvider}`);

  const id = makeConnectionId();
  const connection: AiConnection = {
    id,
    name: preset.label,
    provider: preset.id,
    baseUrl: preset.baseUrl,
    model: legacyModel,
  };
  saveConnections([connection]);
  setActiveConnectionId(id);

  if (legacyKey && legacyKey.trim()) {
    await setSecret(connectionSecretKey(id), legacyKey.trim());
  }
  // Leave the legacy keys in place: removing a saved secret silently is worse
  // than a harmless leftover.
}

/** All saved connections plus whether each one has a key stored. */
export async function listConnections(): Promise<
  (AiConnection & { hasKey: boolean })[]
> {
  const connections = loadConnections();
  return Promise.all(
    connections.map(async (c) => ({
      ...c,
      hasKey: Boolean((await getSecret(connectionSecretKey(c.id)))?.trim()),
    }))
  );
}

export async function getActiveConnection(): Promise<AiConnection | null> {
  const connections = loadConnections();
  if (connections.length === 0) return null;
  const activeId = getActiveConnectionId();
  return connections.find((c) => c.id === activeId) || connections[0];
}

export async function saveConnection(
  connection: AiConnection,
  apiKey?: string
): Promise<void> {
  const connections = loadConnections();
  const index = connections.findIndex((c) => c.id === connection.id);
  if (index >= 0) connections[index] = connection;
  else connections.push(connection);
  saveConnections(connections);

  if (apiKey !== undefined && apiKey.trim()) {
    await setSecret(connectionSecretKey(connection.id), apiKey.trim());
  }
  if (!getActiveConnectionId()) setActiveConnectionId(connection.id);
}

export async function deleteConnection(id: string): Promise<void> {
  const remaining = loadConnections().filter((c) => c.id !== id);
  saveConnections(remaining);
  await removeSecret(connectionSecretKey(id));
  if (getActiveConnectionId() === id) {
    setActiveConnectionId(remaining[0]?.id || null);
  }
}

export async function pickActiveConnection(id: string): Promise<void> {
  setActiveConnectionId(id);
}

export async function hasConnectionKey(id: string): Promise<boolean> {
  return Boolean((await getSecret(connectionSecretKey(id)))?.trim());
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                 */
/* ------------------------------------------------------------------ */

interface HttpResult {
  status: number;
  text: string;
}

async function httpRequest(
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<HttpResult> {
  const allHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) allHeaders["Content-Type"] = "application/json";

  if (isNative()) {
    const response = await CapacitorHttp.request({
      url,
      method,
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
    method,
    headers: allHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
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

/** Build the auth/prelude headers for a connection. */
function buildHeaders(connection: AiConnection, apiKey: string): Record<string, string> {
  const preset = getPreset(connection.provider);
  if (preset.apiStyle === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required for direct browser calls; harmless on device.
      "anthropic-dangerous-direct-browser-access": "true",
    };
  }
  if (preset.apiStyle === "google") {
    // Gemini takes the key in the query string, not an Authorization header.
    return {};
  }
  const headers: Record<string, string> = {};
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  if (preset.extraHeaders) Object.assign(headers, preset.extraHeaders);
  return headers;
}

/** Gemini authenticates with `?key=` on every request. */
function withGoogleKey(url: string, apiKey: string): string {
  if (!apiKey.trim()) return url;
  return `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(
    apiKey.trim()
  )}`;
}

function rawMessage(text: string): string {
  const parsed = parseJson(text);
  return String(parsed?.error?.message || parsed?.message || parsed?.detail || "");
}

/** Turn an HTTP failure into a short, plain-words explanation. */
export function describeHttpError(
  status: number,
  responseText: string,
  label: string
): string {
  const parsed = parseJson(responseText);
  const message =
    parsed?.error?.message || parsed?.message || parsed?.detail || "";
  const lower = typeof message === "string" ? message.toLowerCase() : "";

  if (status === 401 || status === 403) {
    return `The API key was rejected by ${label} (HTTP ${status}). Check the key is pasted correctly and has not expired.`;
  }
  if (status === 404) {
    if (lower.includes("model")) {
      return `${label} could not find that model (HTTP 404). Use "Fetch models" or check the model name.`;
    }
    return `Wrong URL or endpoint for ${label} (HTTP 404). Check the Base URL — it usually ends in /v1.`;
  }
  if (status === 429) {
    return `${label} says you are over the rate limit or out of quota (HTTP 429). Wait a moment or check billing.`;
  }
  if (status >= 500) {
    return `${label} had a server error (HTTP ${status}). Try again shortly.`;
  }
  if (typeof message === "string" && message.trim()) {
    return `${label} returned HTTP ${status}: ${message.trim()}`;
  }
  return `${label} returned HTTP ${status}.`;
}

function networkError(label: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Could not reach ${label}. Check your internet connection and the Base URL. (${detail})`;
}

/* ------------------------------------------------------------------ */
/* Fetch models                                                         */
/* ------------------------------------------------------------------ */

function extractModelIds(parsed: any): string[] {
  if (!parsed) return [];
  // OpenAI / OpenRouter / Groq / etc: { data: [{ id }] }
  if (Array.isArray(parsed.data)) {
    return parsed.data
      .map((m: any) => (typeof m?.id === "string" ? m.id : null))
      .filter((id: string | null): id is string => Boolean(id));
  }
  // Google native: { models: [{ name: "models/gemini-..." }] }
  if (Array.isArray(parsed.models)) {
    return parsed.models
      .map((m: any) => {
        const name = m?.name || m?.id;
        return typeof name === "string" ? name.replace(/^models\//, "") : null;
      })
      .filter((id: string | null): id is string => Boolean(id));
  }
  return [];
}

/** GET {base}/models and return the sorted model ids. */
export async function fetchModels(connection: AiConnection): Promise<string[]> {
  const preset = getPreset(connection.provider);
  const apiKey = (await getSecret(connectionSecretKey(connection.id))) || "";
  let url = joinUrl(connection.baseUrl, "/models");
  if (preset.apiStyle === "google") url = withGoogleKey(url, apiKey);
  let response: HttpResult;
  try {
    response = await httpRequest("GET", url, buildHeaders(connection, apiKey));
  } catch (error) {
    throw new Error(networkError(preset.label, error));
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(describeHttpError(response.status, response.text, preset.label));
  }
  const models = Array.from(new Set(extractModelIds(parseJson(response.text))));
  models.sort((a, b) => a.localeCompare(b));
  return models;
}

/* ------------------------------------------------------------------ */
/* Test + chat                                                          */
/* ------------------------------------------------------------------ */

export interface TestResult {
  ok: boolean;
  message: string;
}

function extractChatText(apiStyle: ApiStyle, parsed: any): string | null {
  if (apiStyle === "anthropic") {
    const parts = parsed?.content;
    if (Array.isArray(parts)) {
      const text = parts
        .filter((p: any) => p?.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("");
      if (text.trim()) return text.trim();
    }
    return null;
  }
  if (apiStyle === "google") {
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const text = parts
        .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
        .join("");
      if (text.trim()) return text.trim();
    }
    return null;
  }
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
    if (text.trim()) return text.trim();
  }
  return null;
}

/** The provider's stop reason: finish_reason / stop_reason / finishReason. */
function extractFinishReason(apiStyle: ApiStyle, parsed: any): string | null {
  if (apiStyle === "anthropic") {
    return typeof parsed?.stop_reason === "string" ? parsed.stop_reason : null;
  }
  if (apiStyle === "google") {
    const reason = parsed?.candidates?.[0]?.finishReason;
    return typeof reason === "string" ? reason : null;
  }
  const reason = parsed?.choices?.[0]?.finish_reason;
  return typeof reason === "string" ? reason : null;
}

/**
 * True when the model stopped because it hit the response-token limit:
 * finish_reason "length" (OpenAI), stop_reason "max_tokens" (Anthropic),
 * finishReason "MAX_TOKENS" (Gemini).
 */
export function hitTokenLimit(
  finishReason: string | null | undefined
): boolean {
  if (!finishReason) return false;
  const reason = finishReason.toLowerCase();
  return reason === "length" || reason === "max_tokens";
}

/**
 * Detect a clear "wrong parameter name" rejection (HTTP 400/404/422 that
 * mentions max_tokens) so the caller can retry once with the other name.
 */
export function isLimitParamError(
  status: number,
  responseText: string
): boolean {
  if (status !== 400 && status !== 404 && status !== 422) return false;
  const parsed = parseJson(responseText);
  const message = String(
    parsed?.error?.message || parsed?.message || parsed?.detail || responseText
  ).toLowerCase();
  if (!message.includes("max_tokens") && !message.includes("max_completion_tokens")) {
    return false;
  }
  return /unknown|unexpected|unsupported|unrecognized|not supported|does not support|invalid|deprecated|instead|use ['"`]?max_/.test(
    message
  );
}

export type OpenAiLimitParam = "max_tokens" | "max_completion_tokens";

export interface ChatRequestOptions {
  /** Response cap, or "model" to let the provider decide. */
  maxResponseTokens: number | "model";
  /** Temperature, or null to leave the provider default alone. */
  temperature: number | null;
  /** OpenAI-compatible parameter name (some models need max_completion_tokens). */
  limitParam?: OpenAiLimitParam;
}

/**
 * Build the URL and JSON body for one chat call, mapped per provider:
 *
 *  - OpenAI-compatible: `max_tokens` (or `max_completion_tokens`), `temperature`
 *  - Anthropic:         `max_tokens` is required — 4096 stands in for "model"
 *  - Google Gemini:     POST /models/{model}:generateContent with
 *                       `generationConfig.maxOutputTokens` / `temperature`
 *
 * Pure (no I/O) so the mapping can be unit-tested.
 */
export function buildChatRequest(
  apiStyle: ApiStyle,
  baseUrl: string,
  rawModel: string,
  messages: ChatMessage[],
  options: ChatRequestOptions
): { url: string; body: Record<string, unknown>; limitParam: OpenAiLimitParam } {
  const model = rawModel.trim();
  const limitParam: OpenAiLimitParam = options.limitParam || "max_tokens";
  const system = messages.find((m) => m.role === "system")?.content;
  const rest = messages.filter((m) => m.role !== "system");

  if (apiStyle === "google") {
    const url = joinUrl(
      baseUrl,
      `/models/${model.replace(/^models\//, "")}:generateContent`
    );
    const body: Record<string, unknown> = {
      contents: rest.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const generationConfig: Record<string, unknown> = {};
    if (options.maxResponseTokens !== "model") {
      generationConfig.maxOutputTokens = options.maxResponseTokens;
    }
    if (options.temperature !== null) {
      generationConfig.temperature = options.temperature;
    }
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }
    return { url, body, limitParam };
  }

  if (apiStyle === "anthropic") {
    const body: Record<string, unknown> = {
      model,
      // Anthropic refuses the request without max_tokens, so "Model default"
      // is sent as the standard 4096 cap.
      max_tokens:
        options.maxResponseTokens === "model" ? 4096 : options.maxResponseTokens,
      ...(system ? { system } : {}),
      messages: rest.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    };
    if (options.temperature !== null) body.temperature = options.temperature;
    return { url: joinUrl(baseUrl, "/messages"), body, limitParam };
  }

  const body: Record<string, unknown> = { model, messages };
  if (options.maxResponseTokens !== "model") {
    body[limitParam] = options.maxResponseTokens;
  }
  if (options.temperature !== null) body.temperature = options.temperature;
  return { url: joinUrl(baseUrl, "/chat/completions"), body, limitParam };
}

/**
 * Send a tiny chat request to prove the connection works, reporting failures
 * in plain words rather than raw JSON.
 */
export async function testConnection(connection: AiConnection): Promise<TestResult> {
  const preset = getPreset(connection.provider);
  const apiKey = (await getSecret(connectionSecretKey(connection.id))) || "";
  const model = (connection.model || preset.defaultModel || "").trim();

  if (!model) {
    return { ok: false, message: "Add a model name before testing (or Fetch models)." };
  }
  if (preset.apiStyle === "anthropic" && !apiKey.trim()) {
    return { ok: false, message: "Add an API key before testing." };
  }

  const request = buildChatRequest(
    preset.apiStyle,
    connection.baseUrl,
    model,
    [{ role: "user", content: "Reply with the single word: ok" }],
    { maxResponseTokens: 8, temperature: null }
  );
  const url =
    preset.apiStyle === "google"
      ? withGoogleKey(request.url, apiKey)
      : request.url;

  let response: HttpResult;
  try {
    response = await httpRequest(
      "POST",
      url,
      buildHeaders(connection, apiKey),
      request.body
    );
  } catch (error) {
    return { ok: false, message: networkError(preset.label, error) };
  }

  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      message: describeHttpError(response.status, response.text, preset.label),
    };
  }

  const text = extractChatText(preset.apiStyle, parseJson(response.text));
  return {
    ok: true,
    message: text
      ? `${preset.label} replied — connection works. ("${text.slice(0, 40)}")`
      : `${preset.label} accepted the request.`,
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Rough token estimate (about four characters per token). */
export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/**
 * Keep the conversation inside a conservative context budget: always keep the
 * system message and the latest user message, dropping the oldest history first.
 */
export const MAX_REQUEST_TOKENS = 12000;

export function fitMessagesToBudget(
  messages: ChatMessage[],
  budget = MAX_REQUEST_TOKENS
): ChatMessage[] {
  let total = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (total <= budget) return messages;

  const result = [...messages];
  // Drop the oldest non-system message until we fit (stop at the last two).
  while (total > budget && result.length > 2) {
    const index = result.findIndex((m) => m.role !== "system");
    if (index === -1) break;
    total -= estimateTokens(result[index].content);
    result.splice(index, 1);
  }
  return result;
}

export interface ChatResult {
  /** Assistant text ("" when the provider returned nothing). */
  text: string;
  /** Why the model stopped — `hitTokenLimit` interprets it. */
  finishReason: string | null;
  /** True when the provider returned no usable text. */
  empty: boolean;
}

/**
 * Send a chat request through a connection.
 *
 * `limits` must already be resolved by the caller (global settings plus any
 * per-connection override — see `resolveTokenLimits`). The conversation is
 * trimmed oldest-first to `limits.maxContextTokens` before it is sent; the
 * system message and the newest message always survive.
 */
export async function chatWithConnection(
  connection: AiConnection,
  messages: ChatMessage[],
  limits: TokenLimits = DEFAULT_TOKEN_LIMITS
): Promise<ChatResult> {
  const trimmed = fitMessagesToBudget(messages, limits.maxContextTokens);
  const preset = getPreset(connection.provider);
  const apiKey = (await getSecret(connectionSecretKey(connection.id))) || "";
  const model = (connection.model || preset.defaultModel || "").trim();
  if (!model) throw new Error("No model set for this connection.");

  const options: ChatRequestOptions = {
    maxResponseTokens: limits.maxResponseTokens,
    temperature: limits.temperature,
  };
  let request = buildChatRequest(
    preset.apiStyle,
    connection.baseUrl,
    model,
    trimmed,
    options
  );

  const post = async (r: typeof request): Promise<HttpResult> => {
    const url =
      preset.apiStyle === "google" ? withGoogleKey(r.url, apiKey) : r.url;
    try {
      return await httpRequest(
        "POST",
        url,
        buildHeaders(connection, apiKey),
        r.body
      );
    } catch (error) {
      throw new Error(networkError(preset.label, error));
    }
  };

  let response = await post(request);

  // Some OpenAI-compatible models want max_completion_tokens instead of
  // max_tokens; retry once with the other name on a clear parameter error.
  if (
    response.status >= 300 &&
    preset.apiStyle === "openai" &&
    isLimitParamError(response.status, response.text)
  ) {
    request = buildChatRequest(preset.apiStyle, connection.baseUrl, model, trimmed, {
      ...options,
      limitParam:
        request.limitParam === "max_tokens"
          ? "max_completion_tokens"
          : "max_tokens",
    });
    response = await post(request);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(describeHttpError(response.status, response.text, preset.label));
  }

  const parsed = parseJson(response.text);
  const text = extractChatText(preset.apiStyle, parsed) || "";
  return {
    text,
    finishReason: extractFinishReason(preset.apiStyle, parsed),
    empty: !text.trim(),
  };
}
