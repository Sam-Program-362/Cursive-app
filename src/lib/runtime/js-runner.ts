"use client";

/**
 * In-browser JavaScript execution.
 *
 * The user's code runs inside a sandboxed, same-origin-less <iframe>
 * (sandbox="allow-scripts") so it cannot touch the editor's DOM, storage or
 * React state. console.* calls inside the frame are overridden and piped back
 * to the host page via postMessage.
 */

export const JS_TIMEOUT_MS = 10_000;

export interface JsRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

function buildHarness(userCode: string, stdin: string, timeoutMs: number) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var TOKEN = ${JSON.stringify("cursive-js-runner")};
  var lines = [];
  function fmt(value) {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || (value.name + ": " + value.message);
    try { return JSON.stringify(value, function (k, v) {
      return typeof v === "bigint" ? v.toString() + "n" : (typeof v === "function" ? "[Function " + (v.name || "anonymous") + "]" : v);
    }, 2); } catch (e) { return String(value); }
  }
  function write(stream, args) {
    lines.push({ stream: stream, text: Array.prototype.map.call(args, fmt).join(" ") });
  }
  console.log = function () { write("out", arguments); };
  console.info = function () { write("out", arguments); };
  console.debug = function () { write("out", arguments); };
  console.warn = function () { write("err", arguments); };
  console.error = function () { write("err", arguments); };
  console.table = function () { write("out", arguments); };

  var stdinData = ${JSON.stringify(stdin)};
  var stdinLines = stdinData.length ? stdinData.split("\\n") : [];
  var stdinIndex = 0;
  // Minimal prompt()/readline() shim backed by the console's stdin box.
  window.prompt = function () { return stdinIndex < stdinLines.length ? stdinLines[stdinIndex++] : null; };
  window.readline = window.prompt;

  var done = false;
  function finish(errText) {
    if (done) return;
    done = true;
    parent.postMessage({ token: TOKEN, lines: lines, error: errText || null }, "*");
  }

  window.onerror = function (message, src, line, col, error) {
    finish(error && error.stack ? error.stack : String(message));
    return true;
  };
  window.onunhandledrejection = function (event) {
    var r = event.reason;
    finish(r && r.stack ? r.stack : String(r));
  };

  setTimeout(function () { finish("TimeoutError: execution exceeded ${Math.round(
    timeoutMs / 1000
  )}s and was stopped."); }, ${timeoutMs});

  (async function () {
    try {
      // eslint-disable-next-line no-new-func
      var fn = new Function(${JSON.stringify(userCode)});
      await fn();
      finish(null);
    } catch (err) {
      finish(err && err.stack ? err.stack : String(err));
    }
  })();
})();
<\/script></body></html>`;
}

export function runJavaScript(
  code: string,
  stdin = "",
  timeoutMs: number = JS_TIMEOUT_MS
): Promise<JsRunResult> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";
    iframe.srcdoc = buildHarness(code, stdin, timeoutMs);

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(hardTimer);
      iframe.remove();
    };

    const finish = (result: JsRunResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.token !== "cursive-js-runner") return;
      if (event.source !== iframe.contentWindow) return;

      const out: string[] = [];
      const err: string[] = [];
      for (const line of data.lines || []) {
        (line.stream === "err" ? err : out).push(line.text);
      }
      const timedOut =
        typeof data.error === "string" && data.error.startsWith("TimeoutError");
      if (data.error) err.push(data.error);

      finish({
        stdout: out.join("\n"),
        stderr: err.join("\n"),
        exitCode: data.error ? 1 : 0,
        timedOut,
      });
    };

    // Safety net in case the frame never reports back at all.
    const hardTimer = setTimeout(() => {
      finish({
        stdout: "",
        stderr: "TimeoutError: the sandbox did not respond in time.",
        exitCode: 1,
        timedOut: true,
      });
    }, timeoutMs + 2000);

    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}
