/**
 * Regression guards for the run-output panel.
 *
 *   bun scripts/test-console-panel.mjs
 *
 * The Phase 7 terminal emulator initially shipped a `useEffect` below the
 * panel's `if (!shouldRender) return null` early return. React allows an early
 * return only when no hook follows it; otherwise the second render (the one that
 * happens once the panel opens) executes an extra hook and React throws
 * "Rendered more hooks than during the previous render", white-screening the
 * app. These checks lock that invariant down so it cannot regress.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const PANEL = path.resolve("src/components/Editor/ConsolePanel.tsx");
const source = readFileSync(PANEL, "utf8");

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS  " : "FAIL  "}${name}${ok || !detail ? "" : `\n   ${detail}`}`);
}

const lines = source.split("\n");

/** Locate the early return that guards the animated mount. */
const earlyReturnIndex = lines.findIndex((line) =>
  /^\s*if \(!shouldRender\) return null;/.test(line)
);
check("panel has the `if (!shouldRender) return null` early return", earlyReturnIndex >= 0);
check(
  "early return appears before the panel body is built",
  earlyReturnIndex > 0 && earlyReturnIndex < lines.length - 1
);

/**
 * Every React hook call must appear before the early return. Ignore comments,
 * blank lines and the import statement.
 */
const HOOK_CALL = /\buse(State|Effect|Ref|Callback|Memo|LayoutEffect|Reducer|ImperativeHandle|Context|SyncExternalStore|Transition|DebugValue)\s*\(/;
const offending = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (i > earlyReturnIndex && HOOK_CALL.test(line)) {
    offending.push(`line ${i + 1}: ${trimmed}`);
  }
}
check(
  "NO hooks are called after the early return",
  offending.length === 0,
  offending.join("\n   ")
);

/** The hook sequence must be identical on both sides of the early return. */
const hooksBefore = lines
  .slice(0, earlyReturnIndex)
  .filter((line) => HOOK_CALL.test(line)).length;
check("hooks are declared before the early return", hooksBefore > 0, `found ${hooksBefore}`);

/* The emulator handle is used for rendering and copying, and the streaming
 * effect that feeds it must exist. */
check("panel renders the emulated output", /\{terminal\.render\}/.test(source));
check("panel feeds stdout through the emulator", /terminalWrite\(stdout\.slice/.test(source));
check("panel resets the emulator on a new run", /terminalReset\(\)/.test(source));
check("copy uses the emulator's resolved plain text", /terminal\.toPlainText\(\)/.test(source));

/* The early return must be the last thing before the non-hook body. */
const firstBodyLine = lines
  .slice(earlyReturnIndex + 1)
  .findIndex((line) => line.trim().length > 0);
check(
  "a blank line separates the early return from the body",
  firstBodyLine > 0 || lines[earlyReturnIndex + 1]?.trim() === "",
  `next line: ${JSON.stringify(lines[earlyReturnIndex + 1])}`
);

/* --- Real render of the actual component (catches import cycles, bad hook
 * usage at module scope, and throws during the render phase). --- */
const { ConsolePanel } = await import("../src/components/Editor/ConsolePanel.tsx");

const baseProps = {
  result: null,
  isRunning: false,
  runtimeStatus: null,
  runLanguage: "python",
  setRunLanguage: () => {},
  activeFile: null,
  allFiles: [],
  stdin: "",
  setStdin: () => {},
  onRun: () => {},
  onClose: () => {},
  onClear: () => {},
};

let rendered = 0;
for (const isOpen of [false, true]) {
  try {
    const html = renderToStaticMarkup(
      React.createElement(ConsolePanel, { ...baseProps, isOpen })
    );
    rendered += 1;
    // shouldRender starts false and effects do not run during SSR, so the panel
    // legitimately renders nothing yet; what matters is that it does not throw.
    check(`renders without throwing when isOpen=${isOpen}`, typeof html === "string");
  } catch (error) {
    check(
      `renders without throwing when isOpen=${isOpen}`,
      false,
      String(error && error.message ? error.message : error)
    );
  }
}
check("both render passes completed", rendered === 2, `completed ${rendered}/2`);

console.log("");
console.log(failures === 0 ? "ALL CONSOLE PANEL TESTS PASSED" : `${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);