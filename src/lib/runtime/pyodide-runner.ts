"use client";

/**
 * In-browser Python execution using Pyodide (CPython compiled to WebAssembly).
 * Pyodide is loaded lazily from the CDN on the first Run so initial page load
 * stays fast.
 */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

export const PYTHON_TIMEOUT_MS = 10_000;

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython: (code: string) => unknown;
  globals: { get: (name: string) => any; set: (name: string, value: any) => void };
  setStdin: (options: { stdin: () => string | null }) => void;
  loadPackage: (names: string | string[]) => Promise<unknown>;
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-pyodide="true"]`
    );
    if (existing) {
      if (window.loadPyodide) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load the Pyodide runtime script."))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.pyodide = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load the Pyodide runtime script."));
    document.head.appendChild(script);
  });
}

/** True once the Python runtime has been downloaded and initialised. */
export function isPythonRuntimeReady(): boolean {
  return pyodidePromise !== null && runtimeReady;
}

let runtimeReady = false;

export async function loadPythonRuntime(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScriptOnce(PYODIDE_SCRIPT_URL);
      if (!window.loadPyodide) {
        throw new Error("Pyodide did not register itself on window.");
      }
      const instance = await window.loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
      });
      runtimeReady = true;
      return instance;
    })().catch((err) => {
      pyodidePromise = null;
      throw err;
    });
  }
  return pyodidePromise;
}

export interface PythonRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/**
 * Run Python source in Pyodide, capturing stdout/stderr and honouring a hard
 * wall-clock timeout so an infinite loop cannot hang the tab indefinitely.
 */
export async function runPython(
  code: string,
  stdin = "",
  timeoutMs: number = PYTHON_TIMEOUT_MS
): Promise<PythonRunResult> {
  const pyodide = await loadPythonRuntime();

  // Feed stdin line by line from the user-supplied input box.
  const stdinLines = stdin.length ? stdin.split("\n") : [];
  let stdinIndex = 0;
  try {
    pyodide.setStdin({
      stdin: () => (stdinIndex < stdinLines.length ? stdinLines[stdinIndex++] : null),
    });
  } catch {
    /* older pyodide builds without setStdin */
  }

  // Redirect sys.stdout / sys.stderr into in-memory string buffers.
  await pyodide.runPythonAsync(`
import sys, io
__cursive_stdout = io.StringIO()
__cursive_stderr = io.StringIO()
sys.stdout = __cursive_stdout
sys.stderr = __cursive_stderr
`);

  const readBuffers = (): { stdout: string; stderr: string } => {
    try {
      const stdout = String(
        pyodide.runPython("__cursive_stdout.getvalue()") ?? ""
      );
      const stderr = String(
        pyodide.runPython("__cursive_stderr.getvalue()") ?? ""
      );
      return { stdout, stderr };
    } catch {
      return { stdout: "", stderr: "" };
    }
  };

  const restore = async () => {
    try {
      await pyodide.runPythonAsync(
        "import sys\nsys.stdout = sys.__stdout__\nsys.stderr = sys.__stderr__\n"
      );
    } catch {
      /* ignore */
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"__timeout__">((resolve) => {
    timer = setTimeout(() => resolve("__timeout__"), timeoutMs);
  });

  try {
    const outcome = await Promise.race([
      pyodide.runPythonAsync(code).then(
        () => ({ ok: true as const }),
        (err: unknown) => ({ ok: false as const, err })
      ),
      timeout,
    ]);

    if (outcome === "__timeout__") {
      const { stdout, stderr } = readBuffers();
      return {
        stdout,
        stderr:
          (stderr ? stderr + "\n" : "") +
          `TimeoutError: execution exceeded ${Math.round(
            timeoutMs / 1000
          )}s and was stopped. (Note: the Python worker may keep spinning until the tab is reloaded.)`,
        exitCode: 1,
        timedOut: true,
      };
    }

    const { stdout, stderr } = readBuffers();
    if (!outcome.ok) {
      const message =
        outcome.err instanceof Error
          ? outcome.err.message
          : String(outcome.err);
      return {
        stdout,
        stderr: (stderr ? stderr + "\n" : "") + message,
        exitCode: 1,
        timedOut: false,
      };
    }
    return { stdout, stderr, exitCode: stderr ? 0 : 0, timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
    await restore();
  }
}

/* ------------------------------------------------------------------ *
 * Lazy Jedi-powered completion (Phase 2)
 *
 * Jedi is only engaged once the Python runtime is already loaded (i.e. the
 * user has run a program at least once). It never triggers the ~10MB Pyodide
 * download by itself, so typing in the editor stays instant.
 * ------------------------------------------------------------------ */

let jediReady = false;

export interface JediCompletion {
  label: string;
  type: string;
}

/**
 * Ask Jedi for completions at the given 1-based line/column inside `code`.
 * Returns an empty array when the Python runtime is not ready yet or Jedi
 * cannot be loaded, so callers can simply merge whatever they get.
 */
export async function getPythonCompletions(
  code: string,
  line: number,
  column: number,
  limit = 60
): Promise<JediCompletion[]> {
  if (!isPythonRuntimeReady()) return [];
  let pyodide: PyodideInterface;
  try {
    pyodide = await loadPythonRuntime();
    if (!jediReady) {
      await pyodide.loadPackage("jedi");
      jediReady = true;
    }
  } catch {
    return [];
  }

  try {
    pyodide.globals.set("__cursive_code", code);
    pyodide.globals.set("__cursive_line", line);
    pyodide.globals.set("__cursive_col", column);
    pyodide.globals.set("__cursive_limit", limit);
    const raw = pyodide.runPython(`
import json as __cursive_json
import jedi as __cursive_jedi
__cursive_script = __cursive_jedi.Script(__cursive_code)
__cursive_items = __cursive_script.complete(__cursive_line, __cursive_col)
__cursive_json.dumps([
    {"label": c.name, "type": getattr(c, "type", "")}
    for c in __cursive_items[:__cursive_limit]
])
`);
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is JediCompletion =>
        !!item && typeof item.label === "string"
    );
  } catch {
    return [];
  }
}

