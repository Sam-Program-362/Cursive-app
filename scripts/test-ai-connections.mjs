/**
 * Tests for the AI connection helpers: provider base URLs (checked against each
 * provider's docs), URL joining, and plain-words error messages.
 *
 *   bun scripts/test-ai-connections.mjs
 */

import {
  PROVIDER_PRESETS,
  getPreset,
  normalizeBaseUrl,
  joinUrl,
  describeHttpError,
  connectionSecretKey,
  buildChatRequest,
  hitTokenLimit,
  isLimitParamError,
  resolveTokenLimits,
  sanitizeTokenLimits,
  clampResponseTokens,
  loadTokenLimits,
  saveTokenLimits,
  DEFAULT_TOKEN_LIMITS,
} from "../src/lib/ai-connections";

let failures = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    ok
      ? `PASS  ${name}`
      : `FAIL  ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`
  );
}

/* Preset base URLs must match the providers' documented endpoints. */
const EXPECTED_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  huggingface: "https://router.huggingface.co/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  together: "https://api.together.xyz/v1",
  mistral: "https://api.mistral.ai/v1",
  local: "http://localhost:11434/v1",
};
for (const [id, url] of Object.entries(EXPECTED_BASE_URLS)) {
  check(`preset ${id} base URL`, getPreset(id).baseUrl, url);
}

check(
  "every required provider is present",
  PROVIDER_PRESETS.map((p) => p.id).sort(),
  [
    "anthropic",
    "custom",
    "deepseek",
    "google",
    "groq",
    "huggingface",
    "local",
    "mistral",
    "openai",
    "openrouter",
    "together",
  ].sort()
);
check("only Anthropic uses the native format", 
  PROVIDER_PRESETS.filter((p) => p.apiStyle === "anthropic").map((p) => p.id),
  ["anthropic"]
);
check("Gemini uses its own native format", getPreset("google").apiStyle, "google");
check("OpenRouter sends attribution headers",
  Boolean(getPreset("openrouter").extraHeaders?.["HTTP-Referer"] &&
    getPreset("openrouter").extraHeaders?.["X-Title"]),
  true
);

/* URL joining tolerates trailing slashes. */
check("normalizeBaseUrl strips trailing slash",
  normalizeBaseUrl("https://api.openai.com/v1///"), "https://api.openai.com/v1");
check("joinUrl appends a path", joinUrl("https://api.openai.com/v1", "/chat/completions"),
  "https://api.openai.com/v1/chat/completions");
check("joinUrl survives a trailing slash on the base",
  joinUrl("https://api.openai.com/v1/", "/models"), "https://api.openai.com/v1/models");

/* Plain-words error messages. */
check("401 mentions the key",
  describeHttpError(401, "{}", "OpenAI").includes("API key"), true);
check("404 with a model mentions the model",
  describeHttpError(404, JSON.stringify({ error: { message: "model not found" } }), "Groq").includes("model"),
  true);
check("404 without a model mentions the URL",
  describeHttpError(404, "{}", "Groq").includes("Base URL"), true);
check("429 mentions rate limit",
  describeHttpError(429, "{}", "OpenAI").includes("rate limit"), true);
check("500 mentions server error",
  describeHttpError(503, "{}", "OpenAI").includes("server error"), true);
check("other statuses include the HTTP code",
  describeHttpError(418, "{}", "OpenAI").includes("418"), true);
check("provider message is surfaced when present",
  describeHttpError(400, JSON.stringify({ message: "bad request" }), "OpenAI").includes("bad request"),
  true);

/* Secret keys are namespaced per connection. */
check("secret key is namespaced", connectionSecretKey("abc"), "cursive_ai_conn_key_abc");

/* ---------------- Token controls ---------------- */

check("default limits match the spec", DEFAULT_TOKEN_LIMITS, {
  maxResponseTokens: 4096,
  maxContextTokens: 16000,
  temperature: null,
});
check("response tokens clamp low", clampResponseTokens(10), 256);
check("response tokens clamp high", clampResponseTokens(999999), 16384);
check("sanitize fills defaults", sanitizeTokenLimits({}), DEFAULT_TOKEN_LIMITS);
check(
  "sanitize accepts model default",
  sanitizeTokenLimits({ maxResponseTokens: "model" }).maxResponseTokens,
  "model"
);
check(
  "no connection uses the globals",
  resolveTokenLimits(null, {
    maxResponseTokens: 8192,
    maxContextTokens: 32000,
    temperature: 0.2,
  }),
  { maxResponseTokens: 8192, maxContextTokens: 32000, temperature: 0.2 }
);
check(
  "connection override wins",
  resolveTokenLimits(
    { overrides: { maxResponseTokens: "model" } },
    DEFAULT_TOKEN_LIMITS
  ),
  { ...DEFAULT_TOKEN_LIMITS, maxResponseTokens: "model" }
);
check(
  "partial override keeps other globals",
  resolveTokenLimits({ overrides: { temperature: 1 } }, DEFAULT_TOKEN_LIMITS),
  { ...DEFAULT_TOKEN_LIMITS, temperature: 1 }
);

/* Global persistence round-trip (fake localStorage). */
{
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  check("no saved limits means the defaults", loadTokenLimits(),
    DEFAULT_TOKEN_LIMITS);
  saveTokenLimits({ maxResponseTokens: 8192 });
  check("saved response limit loads", loadTokenLimits().maxResponseTokens, 8192);
  saveTokenLimits({ temperature: 0.7 });
  check("temperature save keeps other fields", loadTokenLimits(), {
    maxResponseTokens: 8192,
    maxContextTokens: 16000,
    temperature: 0.7,
  });
  saveTokenLimits({ temperature: null });
  check("temperature can be cleared", loadTokenLimits().temperature, null);
  saveTokenLimits({ maxResponseTokens: 999999 });
  check("stored response limit is clamped", loadTokenLimits().maxResponseTokens,
    16384);
  delete globalThis.window;
}

/* ---------------- Per-provider request mapping ---------------- */

const sysAndUser = [
  { role: "system", content: "sys" },
  { role: "user", content: "hello" },
];

/* OpenAI-compatible: max_tokens + temperature. */
const openaiReq = buildChatRequest("openai", "https://api.openai.com/v1",
  "gpt-4o-mini", sysAndUser, { maxResponseTokens: 2048, temperature: 0.7 });
check("openai chat URL", openaiReq.url,
  "https://api.openai.com/v1/chat/completions");
check("openai sends max_tokens", openaiReq.body.max_tokens, 2048);
check("openai sends temperature", openaiReq.body.temperature, 0.7);
check("openai keeps the system message in place",
  openaiReq.body.messages, sysAndUser);

const openaiModel = buildChatRequest("openai", "https://api.openai.com/v1",
  "gpt-4o-mini", sysAndUser, { maxResponseTokens: "model", temperature: null });
check("openai Model default omits the limit",
  "max_tokens" in openaiModel.body, false);
check("openai default temperature is omitted",
  "temperature" in openaiModel.body, false);

const openaiAlt = buildChatRequest("openai", "https://x.ai/v1", "m",
  sysAndUser,
  { maxResponseTokens: 1024, temperature: null,
    limitParam: "max_completion_tokens" });
check("openai can use max_completion_tokens",
  openaiAlt.body.max_completion_tokens, 1024);
check("openai param name is reported for the retry",
  openaiAlt.limitParam, "max_completion_tokens");

/* Anthropic: max_tokens is required; system is a separate field. */
const antReq = buildChatRequest("anthropic", "https://api.anthropic.com/v1",
  "claude-3-5-sonnet-20241022", sysAndUser,
  { maxResponseTokens: 3000, temperature: null });
check("anthropic messages URL", antReq.url,
  "https://api.anthropic.com/v1/messages");
check("anthropic sends max_tokens", antReq.body.max_tokens, 3000);
check("anthropic lifts out the system prompt", antReq.body.system, "sys");
check("anthropic messages exclude the system role",
  antReq.body.messages, [{ role: "user", content: "hello" }]);
const antModel = buildChatRequest("anthropic", "https://api.anthropic.com/v1",
  "claude-3-5-sonnet-20241022", sysAndUser,
  { maxResponseTokens: "model", temperature: null });
check("anthropic Model default still sends max_tokens",
  antModel.body.max_tokens, 4096);

/* Google Gemini: :generateContent with generationConfig. */
const gReq = buildChatRequest("google",
  "https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash",
  sysAndUser, { maxResponseTokens: 4096, temperature: 0.5 });
check("gemini URL", gReq.url,
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
check("gemini generationConfig", gReq.body.generationConfig,
  { maxOutputTokens: 4096, temperature: 0.5 });
check("gemini systemInstruction", gReq.body.systemInstruction,
  { parts: [{ text: "sys" }] });
check("gemini contents", gReq.body.contents,
  [{ role: "user", parts: [{ text: "hello" }] }]);
const gModel = buildChatRequest("google",
  "https://generativelanguage.googleapis.com/v1beta",
  "models/gemini-2.5-flash", sysAndUser,
  { maxResponseTokens: "model", temperature: null });
check("gemini Model default omits generationConfig",
  "generationConfig" in gModel.body, false);
check("gemini strips a models/ prefix", gModel.url.endsWith(
  "/models/gemini-2.5-flash:generateContent"), true);
const gAssistant = buildChatRequest("google",
  "https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash",
  [{ role: "assistant", content: "hi" }],
  { maxResponseTokens: 100, temperature: null });
check("gemini maps assistant to model",
  gAssistant.body.contents[0].role, "model");

/* Cutoff detection across the three stop-reason styles. */
check("openai finish_reason length is a cutoff", hitTokenLimit("length"), true);
check("anthropic stop_reason max_tokens is a cutoff",
  hitTokenLimit("max_tokens"), true);
check("gemini MAX_TOKENS is a cutoff", hitTokenLimit("MAX_TOKENS"), true);
check("a normal stop is not a cutoff", hitTokenLimit("stop"), false);
check("missing reason is not a cutoff", hitTokenLimit(null), false);

/* The max_tokens ↔ max_completion_tokens retry guard. */
const openaiParamErr = JSON.stringify({
  error: {
    message:
      "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
  },
});
check("clear parameter error is detected", isLimitParamError(400, openaiParamErr),
  true);
check("other 400s are not parameter errors",
  isLimitParamError(400, JSON.stringify({
    error: { message: "max_tokens must be an integer" },
  })), false);
check("500s are never retried",
  isLimitParamError(500, openaiParamErr), false);

console.log(
  failures === 0
    ? "\nALL AI CONNECTION TESTS PASSED"
    : `\n${failures} AI CONNECTION TEST(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
