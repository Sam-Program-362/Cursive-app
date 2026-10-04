"use client";

/**
 * AI context injection.
 *
 * The assistant gets a truthful picture of where it is running (an Android
 * editor with on-device CPython, offline, no pip) plus, optionally, the user's
 * current file, selection, project file list and last run output. Everything is
 * bounded by a size budget, secret-looking files are skipped and obvious API
 * keys/tokens are redacted so nothing sensitive is ever sent to a model.
 */

import type { ExecutionResult, FileItem } from "@/types";

export type ProjectAccess = "off" | "file" | "project";

export interface AiSettings {
  systemPrompt: string;
  projectAccess: ProjectAccess;
}

/* Facts read from android/app/build.gradle (Chaquopy version = "3.12",
 * chaquopyVersion 17.0.0, no `pip` block => standard library only). */
export const CPYTHON_VERSION = "3.12";
export const OFFLINE_NOTE =
  "no pip at runtime — only the Python standard library bundled with CPython";

export const DEFAULT_SYSTEM_PROMPT = `You are the coding assistant built into Cursive, a mobile code editor.

## Where you are running
- Platform: Cursive, an Android code editor app (similar to Pydroid 3). The editor is Monaco, embedded in the app.
- Python runs ON THE PHONE with real CPython ${CPYTHON_VERSION} through Chaquopy. Editing and running code work fully offline; there is no server.
- There is ${OFFLINE_NOTE}. You cannot install third-party packages, so never tell the user to "pip install" something to run it in the app. Suggest a standard-library approach instead.
- input() works live: when a program calls input(), the Output panel shows a field where the user types the answer.
- The Output panel is a terminal: it understands "\\r" (carriage return, used for live progress updates) and basic ANSI colours, so print() with \\r works.
- User files live in Documents/Cursive (or the app's private storage). The app can sync with GitHub (push and pull).
- You are view-only: you cannot edit, run or delete the user's files.

## How to answer
- Be a patient coding assistant and tutor for someone on a phone.
- Keep answers short and readable: short sentences, small lists, no walls of text.
- Put code in fenced code blocks with the language tag.
- Explain simply, and prefer a small complete snippet the user can paste in.
- NEVER claim to have run the code or seen its output — you cannot execute anything.
- If a request needs an unavailable package, say so plainly and offer a standard-library alternative.`;

const SYSTEM_PROMPT_KEY = "cursive_ai_system_prompt";
const PROJECT_ACCESS_KEY = "cursive_ai_project_access";

export function loadAiSettings(): AiSettings {
  if (typeof window === "undefined") {
    return { systemPrompt: DEFAULT_SYSTEM_PROMPT, projectAccess: "off" };
  }
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let projectAccess: ProjectAccess = "off";
  try {
    const rawPrompt = window.localStorage.getItem(SYSTEM_PROMPT_KEY);
    if (rawPrompt && rawPrompt.trim()) systemPrompt = rawPrompt;
    const rawAccess = window.localStorage.getItem(PROJECT_ACCESS_KEY);
    if (rawAccess === "off" || rawAccess === "file" || rawAccess === "project") {
      projectAccess = rawAccess;
    }
  } catch {
    /* ignore */
  }
  return { systemPrompt, projectAccess };
}

export function saveAiSettings(patch: Partial<AiSettings>): void {
  if (typeof window === "undefined") return;
  try {
    if (patch.systemPrompt !== undefined) {
      window.localStorage.setItem(SYSTEM_PROMPT_KEY, patch.systemPrompt);
    }
    if (patch.projectAccess !== undefined) {
      window.localStorage.setItem(PROJECT_ACCESS_KEY, patch.projectAccess);
    }
  } catch {
    /* ignore */
  }
}

export function resetSystemPrompt(): string {
  saveAiSettings({ systemPrompt: DEFAULT_SYSTEM_PROMPT });
  return DEFAULT_SYSTEM_PROMPT;
}

/* ------------------------------------------------------------------ */
/* Secret handling                                                      */
/* ------------------------------------------------------------------ */

const SECRET_FILE_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.jks$/i,
  /\.keystore$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
  /(^|\/)secrets?\.(json|ya?ml|toml|ini|txt)$/i,
  /(^|\/)credentials?(\.|$)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.git(\/|$)/i,
];

export function isSecretFile(name: string): boolean {
  const path = (name || "").replace(/\\/g, "/");
  return SECRET_FILE_PATTERNS.some((re) => re.test(path));
}

const TOKEN_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{12,}\b/g,
  /\bgsk_[A-Za-z0-9]{12,}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
];

/** Replace anything that looks like an API key or token. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const re of TOKEN_PATTERNS) out = out.replace(re, "[redacted]");
  return out;
}

/** True when content looks like binary (NUL bytes or mostly non-printable). */
export function looksBinary(content: string): boolean {
  if (content.includes("\u0000")) return true;
  const sample = content.slice(0, 2000);
  if (!sample) return false;
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 0xfffd) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.3;
}

export function withLineNumbers(content: string): string {
  return content
    .split("\n")
    .map((line, index) => `${index + 1} | ${line}`)
    .join("\n");
}

export function approxTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/* ------------------------------------------------------------------ */
/* Context building                                                     */
/* ------------------------------------------------------------------ */

export interface AiContextInput {
  level: ProjectAccess;
  activeFile: FileItem | null;
  files: FileItem[];
  selection?: string;
  lastRun?: ExecutionResult | null;
}

export interface AiContextResult {
  /** The context block appended to the user's message ("" when disabled). */
  text: string;
  /** Names of the files that will be sent (for the "Sending:" preview). */
  fileNames: string[];
  approxTokens: number;
  /** Files left out because they were secret or binary. */
  skipped: string[];
  /** Files shortened to fit the size budget. */
  truncated: string[];
}

/** Total characters allowed for other project files (whole-project mode). */
export const PROJECT_CONTENT_BUDGET = 16000;
/** Longest a single attached file may be before it is truncated. */
export const PER_FILE_BUDGET = 6000;
/** Characters of run output kept. */
export const RUN_OUTPUT_BUDGET = 4000;

function clip(text: string, max: number): { text: string; clipped: boolean } {
  if (text.length <= max) return { text, clipped: false };
  return {
    text: `${text.slice(0, max)}\n… (truncated, ${text.length - max} more characters)`,
    clipped: true,
  };
}

/**
 * Build the context block for a message. Returns empty text when project access
 * is "off" so the assistant behaves as before.
 */
export function buildAiContext(input: AiContextInput): AiContextResult {
  const { level, activeFile, files, selection, lastRun } = input;
  const skipped: string[] = [];
  const truncated: string[] = [];
  const fileNames: string[] = [];

  if (level === "off") {
    return { text: "", fileNames, approxTokens: 0, skipped, truncated };
  }

  const parts: string[] = [];

  if (activeFile && !activeFile.isFolder) {
    const raw = redactSecrets(activeFile.content || "");
    const clipped = clip(withLineNumbers(raw), PER_FILE_BUDGET);
    if (clipped.clipped) truncated.push(activeFile.name);
    parts.push(
      `### Active file: ${activeFile.name}\n\`\`\`${activeFile.language || ""}\n${clipped.text}\n\`\`\``
    );
    fileNames.push(activeFile.name);
  }

  if (selection && selection.trim()) {
    parts.push(
      `### Selected text (in ${activeFile?.name || "the editor"})\n\`\`\`${
        activeFile?.language || ""
      }\n${redactSecrets(selection)}\n\`\`\``
    );
  }

  if (lastRun && (lastRun.stdout || lastRun.stderr || lastRun.error)) {
    const output = [
      lastRun.stdout ? `stdout:\n${lastRun.stdout}` : "",
      lastRun.stderr ? `stderr:\n${lastRun.stderr}` : "",
      lastRun.error ? `error:\n${lastRun.error}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const clipped = clip(redactSecrets(output), RUN_OUTPUT_BUDGET);
    if (clipped.clipped) truncated.push("last run output");
    parts.push(
      `### Last run output${
        typeof lastRun.exitCode === "number" ? ` (exit code ${lastRun.exitCode})` : ""
      }\n\`\`\`\n${clipped.text}\n\`\`\``
    );
  }

  if (level === "project") {
    const candidates = files.filter(
      (f) =>
        !f.isFolder &&
        f.id !== activeFile?.id &&
        (f.content || "").trim().length > 0
    );

    // Drop secret and binary files before they appear anywhere in the context,
    // including the file list.
    const others = candidates.filter((file) => {
      if (isSecretFile(file.path || file.name) || looksBinary(file.content || "")) {
        skipped.push(file.name);
        return false;
      }
      return true;
    });

    if (others.length > 0) {
      parts.push(
        `### Files in this project\n${others
          .map((f) => `- ${f.path || f.name}`)
          .join("\n")}`
      );
    }

    let budgetLeft = PROJECT_CONTENT_BUDGET;
    for (const file of others) {
      if (budgetLeft <= 0) break;
      const label = file.path || file.name;
      const allowed = Math.min(PER_FILE_BUDGET, budgetLeft);
      const clipped = clip(redactSecrets(file.content || ""), allowed);
      if (clipped.clipped) truncated.push(file.name);
      parts.push(
        `### File: ${label}\n\`\`\`${file.language || ""}\n${clipped.text}\n\`\`\``
      );
      fileNames.push(file.name);
      budgetLeft -= clipped.text.length;
    }
  }

  if (parts.length === 0) {
    return { text: "", fileNames, approxTokens: 0, skipped, truncated };
  }

  const text = `## Project context from Cursive\n${parts.join("\n\n")}`;
  return {
    text,
    fileNames,
    approxTokens: approxTokens(text),
    skipped,
    truncated,
  };
}

/** Human-readable "Sending: …" summary for the context preview. */
export function describeContext(result: AiContextResult): string {
  if (!result.text || result.fileNames.length === 0) return "Sending: no files";
  const names = result.fileNames.join(", ");
  const tokens =
    result.approxTokens >= 1000
      ? `${(result.approxTokens / 1000).toFixed(1)}k`
      : `${result.approxTokens}`;
  return `Sending: ${names} (about ${tokens} tokens)`;
}
