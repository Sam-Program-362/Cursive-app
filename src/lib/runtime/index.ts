"use client";

import { ExecutionResult } from "@/types";
import { runPython, loadPythonRuntime, PYTHON_TIMEOUT_MS } from "./pyodide-runner";
import { runJavaScript, JS_TIMEOUT_MS } from "./js-runner";

export { loadPythonRuntime, isPythonRuntimeReady } from "./pyodide-runner";
export { PYTHON_TIMEOUT_MS } from "./pyodide-runner";
export { JS_TIMEOUT_MS } from "./js-runner";

/** Languages that can actually execute in the browser today. */
export const BROWSER_RUNTIMES = ["python", "javascript", "html"] as const;
export type BrowserRuntime = (typeof BROWSER_RUNTIMES)[number];

export function canRunInBrowser(languageId: string): boolean {
  return (BROWSER_RUNTIMES as readonly string[]).includes(languageId);
}

export interface ExecuteOptions {
  /** Called right before a runtime has to be downloaded (first Python run). */
  onRuntimeLoading?: () => void;
}

/**
 * Execute code entirely on the visitor's device — no server, no API keys,
 * no rate limits.
 */
export async function executeInBrowser(
  languageId: string,
  code: string,
  stdin = "",
  options: ExecuteOptions = {}
): Promise<ExecutionResult> {
  const started = Date.now();

  if (!code.trim()) {
    return {
      stdout: "",
      stderr: "There is nothing to run — the file is empty.",
      output: "There is nothing to run — the file is empty.",
      exitCode: 1,
      language: languageId,
      status: "error",
    };
  }

  const base = (
    stdout: string,
    stderr: string,
    exitCode: number,
    engine: string,
    version?: string
  ): ExecutionResult => ({
    stdout,
    stderr,
    output:
      [stdout, stderr].filter(Boolean).join("\n") ||
      "Program executed with no output.",
    exitCode,
    executionTime: Date.now() - started,
    language: languageId,
    version,
    status: exitCode === 0 ? "success" : "error",
    engine,
  });

  try {
    if (languageId === "python") {
      options.onRuntimeLoading?.();
      await loadPythonRuntime();
      const res = await runPython(code, stdin, PYTHON_TIMEOUT_MS);
      return base(res.stdout, res.stderr, res.exitCode, "pyodide-wasm", "3.12");
    }

    if (languageId === "javascript") {
      const res = await runJavaScript(code, stdin, JS_TIMEOUT_MS);
      return base(res.stdout, res.stderr, res.exitCode, "browser-iframe");
    }

    if (languageId === "html") {
      return base(
        "HTML rendered in the Preview tab.",
        "",
        0,
        "browser-iframe"
      );
    }

    const message = `Running ${languageId} isn't supported yet — Cursive executes code in your browser, and only Python and JavaScript have browser runtimes right now.`;
    return base("", message, 1, "unsupported");
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to execute code in the browser.";
    return base("", message, 1, "browser");
  }
}
