"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExecutionResult, FileItem } from "@/types";
import { RUNNABLE_LANGUAGES, COMING_SOON_LANGUAGES } from "@/lib/languages";
import {
  loadConsolePrefs,
  saveConsolePrefs,
  CONSOLE_PANEL_MIN_WIDTH,
  CONSOLE_PANEL_DEFAULT_WIDTH,
} from "@/lib/storage";
import {
  Terminal,
  RotateCcw,
  Copy,
  Check,
  Globe,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface ConsolePanelProps {
  isOpen: boolean;
  result: ExecutionResult | null;
  isRunning: boolean;
  /** e.g. "Loading Python runtime..." shown while a runtime downloads. */
  runtimeStatus?: string | null;
  /** Language the Run button will execute the active file as. */
  runLanguage: string;
  setRunLanguage: (id: string) => void;
  activeFile: FileItem | null;
  allFiles: FileItem[];
  stdin: string;
  setStdin: (val: string) => void;
  onRun: () => void;
  onClose: () => void;
  onClear: () => void;
}

/** Panel never takes more than this fraction of the viewport width. */
const MAX_WIDTH_FRACTION = 0.8;
/** Mobile breakpoint — matches the app's `md:` (768px) sidebar behavior. */
const DESKTOP_QUERY = "(min-width: 768px)";
/** Transition duration in ms — kept in sync with the CSS classes below. */
const PANEL_TRANSITION_MS = 200;

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  isOpen,
  result,
  isRunning,
  runtimeStatus,
  runLanguage,
  setRunLanguage,
  activeFile,
  allFiles,
  stdin,
  setStdin,
  onRun,
  onClose,
  onClear,
}) => {
  const [activeTab, setActiveTab] = useState<"terminal" | "preview">("terminal");
  const [copied, setCopied] = useState(false);

  // --- Panel layout state -------------------------------------------------
  const [panelWidth, setPanelWidth] = useState(() => loadConsolePrefs().width);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Narrow screens: overlay drawer. Wide screens: inline split pane.
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia(DESKTOP_QUERY).matches
  );

  // Keep the panel mounted briefly while it animates out.
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  // The user's preferred width (unclamped by transient window sizes).
  const preferredWidthRef = useRef(panelWidth);

  /* ------------------------------------------------------------------ */
  /* Open / close slide-in animation lifecycle                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Wait two frames so the initial (off-screen) styles commit
      // before transitioning to the visible state.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setIsVisible(true))
      );
    } else {
      setIsVisible(false);
      const t = setTimeout(() => setShouldRender(false), PANEL_TRANSITION_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /* ------------------------------------------------------------------ */
  /* Responsive mode: overlay drawer (< 768px) vs split pane (>= 768px)  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsMobile(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Clamp panel width when the window shrinks (without clobbering the   */
  /* user's stored preference, so it restores when the window regrows).  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const handleWindowResize = () => {
      const maxW = Math.max(
        CONSOLE_PANEL_MIN_WIDTH,
        Math.floor(window.innerWidth * MAX_WIDTH_FRACTION)
      );
      setPanelWidth(Math.max(CONSOLE_PANEL_MIN_WIDTH, Math.min(preferredWidthRef.current, maxW)));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  if (!shouldRender) return null;

  const handleCopy = () => {
    if (!result?.output) return;
    navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /* ------------------------------------------------------------------ */
  /* Drag-to-resize (split-pane mode): grab the panel's left edge        */
  /* ------------------------------------------------------------------ */
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Start from the panel's current rendered width, so dragging out of
    // the maximized state feels continuous.
    const startWidth =
      panelRef.current?.getBoundingClientRect().width ?? panelWidth;
    const startX = e.clientX;
    let latest = startWidth;

    // Dragging switches off "maximized" and resumes from the real width.
    setIsMaximized(false);
    setIsResizing(true);
    setPanelWidth(startWidth);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const maxWidth = () =>
      Math.max(
        CONSOLE_PANEL_MIN_WIDTH,
        Math.floor(window.innerWidth * MAX_WIDTH_FRACTION)
      );

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(
        CONSOLE_PANEL_MIN_WIDTH,
        Math.min(maxWidth(), startWidth - (ev.clientX - startX))
      );
      latest = next;
      setPanelWidth(next);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizing(false);

      const finalWidth = Math.round(latest);
      preferredWidthRef.current = finalWidth;
      setPanelWidth(finalWidth);
      saveConsolePrefs({ width: finalWidth });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const resetWidth = () => {
    preferredWidthRef.current = CONSOLE_PANEL_DEFAULT_WIDTH;
    setIsMaximized(false);
    setPanelWidth(CONSOLE_PANEL_DEFAULT_WIDTH);
    saveConsolePrefs({ width: CONSOLE_PANEL_DEFAULT_WIDTH });
  };

  const isWebFile =
    activeFile?.name.endsWith(".html") ||
    activeFile?.name.endsWith(".htm") ||
    activeFile?.language === "html";

  // Construct combined HTML for web live preview
  const getWebPreviewSrc = () => {
    if (!activeFile) return "";
    let html = activeFile.content;

    // If active file is HTML, inject linked CSS/JS files if present in workspace
    if (activeFile.name.endsWith(".html")) {
      const cssFiles = allFiles.filter((f) => f.name.endsWith(".css"));
      const jsFiles = allFiles.filter((f) => f.name.endsWith(".js"));

      for (const css of cssFiles) {
        html = html.replace(
          `<link rel="stylesheet" href="${css.name}" />`,
          `<style>${css.content}</style>`
        );
        html = html.replace(
          `<link rel="stylesheet" href="${css.path}" />`,
          `<style>${css.content}</style>`
        );
      }

      for (const js of jsFiles) {
        html = html.replace(
          `<script src="${js.name}"></script>`,
          `<script>${js.content}</script>`
        );
        html = html.replace(
          `<script src="${js.path}"></script>`,
          `<script>${js.content}</script>`
        );
      }
    }

    return html;
  };

  const effectiveWidth = Math.max(
    CONSOLE_PANEL_MIN_WIDTH,
    Math.min(
      panelWidth,
      Math.floor(window.innerWidth * MAX_WIDTH_FRACTION)
    )
  );

  /* ------------------------------------------------------------------ */
  /* Shared panel body — identical content in both layouts               */
  /* ------------------------------------------------------------------ */
  const panelContent = (
    <>
      {/* Panel Header: title + actions */}
      <div className="flex items-center justify-between gap-2 pl-3 pr-1.5 py-1.5 bg-slate-900 border-b border-slate-800 select-none shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate">
            Output
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Run language selector — browser runtimes only */}
          <select
            value={runLanguage}
            onChange={(e) => setRunLanguage(e.target.value)}
            title="Code runs in your browser — Python via Pyodide, JavaScript natively"
            className="hidden sm:block bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-600 max-w-[110px]"
          >
            {RUNNABLE_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
            {COMING_SOON_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} disabled>
                {lang.name}
              </option>
            ))}
          </select>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClear}
            title="Clear Console"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Output"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Maximize / Restore Panel */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore Panel Size" : "Maximize Panel"}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Panel */}
          <button
            type="button"
            onClick={onClose}
            title="Close Output Panel"
            className="p-1 rounded hover:bg-red-950/60 text-slate-400 hover:text-red-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs + Execution Status Row */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-slate-900/60 border-b border-slate-800/70 select-none shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === "terminal"
                ? "bg-slate-800 text-blue-400 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal Output</span>
          </button>

          {isWebFile && (
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === "preview"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Preview</span>
            </button>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <span className="flex items-center gap-1 text-[11px] text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/50 animate-pulse whitespace-nowrap">
              {runtimeStatus || "Running..."}
            </span>
          ) : result?.status === "success" ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3" />
              Exit {result.exitCode ?? 0}
            </span>
          ) : result?.status === "error" ? (
            <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/50 whitespace-nowrap">
              <AlertCircle className="w-3 h-3" />
              Error ({result.exitCode ?? 1})
            </span>
          ) : null}

          {/* Execution Time */}
          {result?.executionTime !== undefined && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
              <Clock className="w-3 h-3" />
              {result.executionTime}ms
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {activeTab === "terminal" ? (
          <div className="flex-1 flex flex-col overflow-hidden p-3 font-mono text-xs min-h-0">
            {/* Output Scrollable Area */}
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap leading-relaxed space-y-1">
              {isRunning && (
                <div className="text-blue-400 flex items-center gap-2">
                  <span className="animate-spin">🌀</span>
                  <span>
                    {runtimeStatus ||
                      `Executing ${activeFile?.name || "code"} in your browser...`}
                  </span>
                </div>
              )}

              {result?.stdout && (
                <div className="text-slate-200">{result.stdout}</div>
              )}

              {result?.stderr && (
                <div className="text-red-400 bg-red-950/30 p-2 rounded border border-red-900/40">
                  {result.stderr}
                </div>
              )}

              {!isRunning && !result && (
                <div className="text-slate-600">
                  Click <strong className="text-slate-400">Run</strong> or press{" "}
                  <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">
                    Ctrl+Enter
                  </kbd>{" "}
                  to execute code and view output here.
                </div>
              )}
            </div>

            {/* Interactive Stdin Row */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5 shrink-0">
              <span className="text-slate-500 text-[11px] font-medium">
                Standard Input (stdin):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Optional input passed to program..."
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRun();
                  }}
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={onRun}
                  disabled={isRunning}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-semibold shrink-0 transition-colors"
                >
                  Run
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Web Preview Iframe */
          <div className="flex-1 w-full h-full bg-white min-h-0">
            <iframe
              srcDoc={getWebPreviewSrc()}
              title="Web Preview"
              sandbox="allow-scripts allow-modals"
              className="w-full h-full border-none"
            />
          </div>
        )}
      </div>
    </>
  );

  /* ------------------------------------------------------------------ */
  /* Mobile: slide-in overlay drawer with backdrop (tap outside closes)  */
  /* ------------------------------------------------------------------ */
  if (isMobile) {
    return (
      <>
        {/* Semi-transparent backdrop — tap to dismiss */}
        <div
          onClick={onClose}
          className={`absolute inset-0 z-30 bg-black/60 transition-opacity duration-200 ease-out ${
            isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        <div
          ref={panelRef}
          className={`absolute inset-y-0 right-0 z-40 flex flex-col h-full bg-slate-950 border-l border-slate-800 shadow-2xl transition-transform duration-200 ease-out ${
            isVisible ? "translate-x-0" : "translate-x-full"
          }`}
          style={{
            width: isMaximized ? "100%" : "min(88vw, 480px)",
          }}
        >
          {panelContent}
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Desktop: side-by-side split pane, pushed in from the right          */
  /* ------------------------------------------------------------------ */
  // When maximized, the wrapper flexes to take ~4/5 of the free space
  // (alongside the file sidebar / notepad if those are open too), which
  // guarantees the layout never overflows regardless of sibling panels.
  const isSplitMaximized = isVisible && isMaximized;

  return (
    <div
      className={`h-full overflow-hidden flex justify-end min-w-0 ${
        isSplitMaximized ? "flex-[4_1_0%]" : ""
      } ${isResizing ? "" : "transition-[width] duration-200 ease-out"}`}
      style={
        isSplitMaximized
          ? undefined
          : { width: isVisible ? `${effectiveWidth}px` : 0 }
      }
    >
      <div
        ref={panelRef}
        className="h-full flex flex-col shrink-0 bg-slate-950 border-l border-slate-800 shadow-2xl relative"
        style={{ width: isMaximized ? "100%" : `${effectiveWidth}px` }}
      >
        {/* Drag handle — resize by dragging the panel's left edge */}
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          title="Drag to resize · double-click to reset"
          className="hidden md:block absolute left-0 inset-y-0 w-1.5 z-30 cursor-col-resize touch-none group"
        >
          <div className="h-full w-full bg-transparent group-hover:bg-blue-500/50 group-active:bg-blue-500/70 transition-colors" />
        </div>

        {panelContent}
      </div>
    </div>
  );
};
