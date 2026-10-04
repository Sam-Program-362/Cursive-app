/**
 * Tests for AI context injection: secret-file filtering, token redaction,
 * line numbering, the size budget and the "Sending:" preview.
 *
 *   bun scripts/test-ai-context.mjs
 */

import {
  buildAiContext,
  describeContext,
  isSecretFile,
  looksBinary,
  redactSecrets,
  withLineNumbers,
  approxTokens,
  DEFAULT_SYSTEM_PROMPT,
  PROJECT_CONTENT_BUDGET,
} from "../src/lib/ai-context";
import { fitMessagesToBudget } from "../src/lib/ai-connections";

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

/* Secret files are recognised and skipped. */
check(".env is secret", isSecretFile(".env"), true);
check("nested .env.local is secret", isSecretFile("config/.env.local"), true);
check("id_rsa is secret", isSecretFile("keys/id_rsa"), true);
check("server.key is secret", isSecretFile("server.key"), true);
check("secrets.json is secret", isSecretFile("secrets.json"), true);
check("a normal python file is not secret", isSecretFile("main.py"), false);
check("a normal markdown file is not secret", isSecretFile("notes.md"), false);

/* Token redaction. */
check("openai key is redacted",
  redactSecrets("key = 'sk-abcdefghijklmnopqrstuvwx'").includes("[redacted]"), true);
check("google key is redacted",
  redactSecrets("AIzaSyA1234567890abcdefghijklmnop").includes("[redacted]"), true);
check("groq key is redacted",
  redactSecrets("gsk_ABCDEFGHIJKLMNOPQRSTUV").includes("[redacted]"), true);
check("normal code is untouched",
  redactSecrets("def add(a, b):\n    return a + b"), "def add(a, b):\n    return a + b");

/* Binary detection. */
check("NUL byte means binary", looksBinary("abc\u0000def"), true);
check("plain text is not binary", looksBinary("hello world\nsecond line"), false);

/* Line numbers. */
check("line numbers are added", withLineNumbers("a\nb"), "1 | a\n2 | b");

check("token estimate is about chars/4", approxTokens("abcdefgh"), 2);

/* Access = off sends no context. */
const offResult = buildAiContext({
  level: "off",
  activeFile: { id: "1", name: "main.py", language: "python", content: "print(1)" },
  files: [],
});
check("off level produces no context", offResult.text, "");
check("off level lists no files", offResult.fileNames, []);

const active = {
  id: "1",
  projectId: "p",
  name: "main.py",
  path: "/main.py",
  language: "python",
  content: "print('hi')",
  isFolder: false,
  createdAt: "",
  updatedAt: "",
};
const utils = {
  id: "2",
  projectId: "p",
  name: "utils.py",
  path: "/utils.py",
  language: "python",
  content: "def double(x):\n    return x * 2",
  isFolder: false,
  createdAt: "",
  updatedAt: "",
};
const envFile = {
  id: "3",
  projectId: "p",
  name: ".env",
  path: "/.env",
  language: "plaintext",
  content: "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx",
  isFolder: false,
  createdAt: "",
  updatedAt: "",
};

/* Access = file sends the active file with line numbers + selection. */
const fileResult = buildAiContext({
  level: "file",
  activeFile: active,
  files: [active, utils],
  selection: "print('hi')",
});
check("file level includes the active file", fileResult.text.includes("main.py"), true);
check("file level adds line numbers", fileResult.text.includes("1 | print('hi')"), true);
check("file level includes the selection", fileResult.text.includes("Selected text"), true);
check("file level does not send other files", fileResult.text.includes("utils.py"), false);
check("file level names the active file", fileResult.fileNames, ["main.py"]);

/* Access = project also sends other files, but skips secrets. */
const projectResult = buildAiContext({
  level: "project",
  activeFile: active,
  files: [active, utils, envFile],
});
check("project level sends other files", projectResult.text.includes("utils.py"), true);
check("project level lists the file list", projectResult.text.includes("Files in this project"), true);
check("project level skips secret files", projectResult.text.includes(".env"), false);
check("project level reports the skipped secret", projectResult.skipped.includes(".env"), true);

/* Secret-looking tokens inside a sent file are redacted. */
const secretInline = buildAiContext({
  level: "file",
  activeFile: { ...active, content: "API_KEY = 'sk-abcdefghijklmnopqrstuvwx'" },
  files: [],
});
check("tokens inside sent code are redacted",
  secretInline.text.includes("sk-abcdefghijklmnopqrstuvwx"), false);

/* Size budget: a huge extra file is truncated, not sent whole. */
const huge = {
  ...utils,
  id: "9",
  name: "huge.py",
  path: "/huge.py",
  content: "x".repeat(PROJECT_CONTENT_BUDGET * 2),
};
const budgetResult = buildAiContext({
  level: "project",
  activeFile: active,
  files: [active, huge],
});
check("huge files are truncated", budgetResult.truncated.includes("huge.py"), true);
check("truncated text is marked", budgetResult.text.includes("truncated"), true);

/* Preview line. */
check("preview names files and tokens",
  describeContext(projectResult).startsWith("Sending: main.py, utils.py (about "), true);

/* History budget trimming drops the oldest messages first. */
{
  const big = "x".repeat(40000); // ~10000 tokens
  const history = [
    { role: "system", content: "sys" },
    { role: "user", content: "old question" },
    { role: "assistant", content: big },
    { role: "user", content: "new question" },
  ];
  const fitted = fitMessagesToBudget(history, 5000);
  check("budget keeps the system message", fitted[0].content, "sys");
  check("budget keeps the newest user message", fitted[fitted.length - 1].content, "new question");
  check("budget dropped the old message", fitted.some((m) => m.content === "old question"), false);
}

/* The default prompt states the platform facts truthfully. */
check("default prompt mentions Android", DEFAULT_SYSTEM_PROMPT.includes("Android"), true);
check("default prompt mentions CPython", DEFAULT_SYSTEM_PROMPT.includes("CPython"), true);
check("default prompt says no pip", /no pip/i.test(DEFAULT_SYSTEM_PROMPT), true);
check("default prompt says it cannot run code",
  /NEVER claim to have run/i.test(DEFAULT_SYSTEM_PROMPT), true);
check("default prompt mentions input()",
  DEFAULT_SYSTEM_PROMPT.includes("input()"), true);

console.log(
  failures === 0
    ? "\nALL AI CONTEXT TESTS PASSED"
    : `\n${failures} AI CONTEXT TEST(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
