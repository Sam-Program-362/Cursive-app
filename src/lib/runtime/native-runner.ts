"use client";

/**
 * Native (Android) Python execution bridge.
 *
 * In the installed Cursive app, Python runs on a real CPython interpreter
 * (Chaquopy) instead of Pyodide, so `input()`, file access and cross-file
 * imports behave like a desktop terminal. On the web this module is inert and
 * `isNativePlatform()` returns false, leaving the Pyodide path untouched.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeProjectFile {
  path: string;
  content: string;
}

export interface NativeRunHandlers {
  onStdout: (text: string) => void;
  onStderr: (text: string) => void;
  onInputRequest: (prompt: string) => void;
  onExit: (code: number) => void;
}

interface PluginListenerHandle {
  remove: () => void | Promise<void>;
}

interface PythonRunnerPluginShape {
  run: (options: {
    projectFiles: NativeProjectFile[];
    entryFile: string;
  }) => Promise<unknown>;
  sendInput: (options: { text: string }) => Promise<unknown>;
  stop: () => Promise<unknown>;
  addListener: (
    event: string,
    callback: (data: any) => void
  ) => Promise<PluginListenerHandle>;
}

let plugin: PythonRunnerPluginShape | null = null;
let listeners: PluginListenerHandle[] = [];

function getPlugin(): PythonRunnerPluginShape {
  if (!plugin) {
    plugin = registerPlugin<PythonRunnerPluginShape>("PythonRunner");
  }
  return plugin;
}

/** True only inside the installed Android app. */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function clearListeners(): Promise<void> {
  const current = listeners;
  listeners = [];
  await Promise.all(
    current.map(async (handle) => {
      try {
        await handle.remove();
      } catch {
        /* listener already gone */
      }
    })
  );
}

/**
 * Write the project to the device and start the entry file.
 * Resolves as soon as execution has started; results arrive via `handlers`.
 */
export async function startNativePythonRun(
  files: NativeProjectFile[],
  entryFile: string,
  handlers: NativeRunHandlers
): Promise<void> {
  const runner = getPlugin();
  await clearListeners();

  listeners.push(
    await runner.addListener("stdout", (data) =>
      handlers.onStdout(String(data?.text ?? ""))
    )
  );
  listeners.push(
    await runner.addListener("stderr", (data) =>
      handlers.onStderr(String(data?.text ?? ""))
    )
  );
  listeners.push(
    await runner.addListener("inputRequest", (data) =>
      handlers.onInputRequest(String(data?.prompt ?? ""))
    )
  );
  listeners.push(
    await runner.addListener("exit", (data) =>
      handlers.onExit(Number(data?.code ?? 0))
    )
  );

  await runner.run({ projectFiles: files, entryFile });
}

/** Send one line of stdin to a blocked `input()` call. */
export async function sendNativeInput(text: string): Promise<void> {
  try {
    await getPlugin().sendInput({ text });
  } catch {
    /* the run may already have ended */
  }
}

/** Interrupt a running program (and unblock `input()`). */
export async function stopNativePython(): Promise<void> {
  try {
    await getPlugin().stop();
  } catch {
    /* nothing running */
  }
}
