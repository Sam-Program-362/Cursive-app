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
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
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

console.log(
  failures === 0
    ? "\nALL AI CONNECTION TESTS PASSED"
    : `\n${failures} AI CONNECTION TEST(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
