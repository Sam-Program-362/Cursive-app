"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExecutionResult, FileItem } from "@/types";
import { generateSmartCodeAssistance, type AIAction } from "@/lib/ai-fallback";
import { generateAiAssistance, getAiConfig, turnTask } from "@/lib/ai-client";
import {
  buildAiContext,
  describeContext,
  loadAiSettings,
  type AiSettings,
} from "@/lib/ai-context";
import { hitTokenLimit } from "@/lib/ai-connections";
import {
  deleteThread,
  deriveTitle,
  loadActiveThread,
  makeThreadId,
  MAX_SAVED_CHATS,
  parseFencedBlocks,
  saveThread,
  threadToMessages,
  type ChatThread,
  type ChatTurn,
} from "@/lib/ai-chat";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  Sparkles,
  X,
  Copy,
  Check,
  Lightbulb,
  Wrench,
  RotateCcw,
  Loader2,
  AlertCircle,
  KeyRound,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  CornerDownLeft,
} from "lucide-react";

interface AIModalProps {
  isOpen: boolean;
  activeFile: FileItem | null;
  /** All files in the project (used for the "Whole project" context level). */
  files?: FileItem[];
  /** The last run's output, attached as context when project access allows it. */
  lastRunResult?: ExecutionResult | null;
  /** Reads the current editor selection, if any. */
  getSelection?: () => string;
  onClose: () => void;
  onInsertCode: (code: string) => void;
  onReplaceCode: (code: string) => void;
  onOpenSettings?: () => void;
}

/** Follow-up suggestions offered under a finished answer. */
const FOLLOW_UP_CHIPS = [
  "Explain more - go deeper, with a concrete example.",
  "Show a short, complete example.",
  "How would you test this?",
];

export const AIModal: React.FC<AIModalProps> = ({
  isOpen,
  activeFile,
  files = [],
  lastRunResult = null,
  getSelection,
  onClose,
  onInsertCode,
  onReplaceCode,
  onOpenSettings,
}) => {
  const online = useOnlineStatus();
  const [prompt, setPrompt] = useState("");
  const [action, setAction] = useState<AIAction>("complete");
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<string>("");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AiSettings>({
    systemPrompt: "",
    projectAccess: "off",
  });
  const [includeContext, setIncludeContext] = useState(false);
  const [selection, setSelection] = useState("");
  /** The last answer stopped at the response-token limit. */
  const [cutOff, setCutOff] = useState(false);
  /** Plain-words hint shown when the model returns an empty answer. */
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loaded = loadAiSettings();
    setSettings(loaded);
    setIncludeContext(loaded.projectAccess !== "off");
    setError(null);
    setCutOff(false);
    setNotice(null);
    setThread(loadActiveThread());
    setSelection(getSelection ? getSelection() : "");
    getAiConfig().then((config) => {
      if (!cancelled) setConfigured(config.hasKey);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // What will be attached to the next message (recomputed as the user edits).
  const contextResult = useMemo(
    () =>
      buildAiContext({
        level: settings.projectAccess,
        activeFile,
        files,
        selection,
        lastRun: lastRunResult,
      }),
    [settings.projectAccess, activeFile, files, selection, lastRunResult]
  );

  const turns = thread?.turns || [];
  const lastTurn = turns[turns.length - 1];
  const hasAnswer = turns.some((t) => t.role === "assistant");

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, isLoading]);

  if (!isOpen) return null;

  const contextEnabledNow =
    includeContext &&
    settings.projectAccess !== "off" &&
    contextResult.text.length > 0;
  const contextText = contextEnabledNow ? contextResult.text : undefined;

  const startNewChat = () => {
    if (thread) deleteThread(thread.id);
    setThread(null);
    setPrompt("");
    setError(null);
    setCutOff(false);
    setNotice(null);
    setCopied(null);
  };

  /**
   * Send one turn. `priorTurns` is the conversation so far (task text only);
   * the freshest project context is attached to this message only.
   */
  const sendTurn = async (input: {
    action: AIAction;
    /** Task text for the model (no context block). */
    prompt: string;
    /** What the user bubble shows. */
    display: string;
    /** What later turns replay for this turn; defaults to `display`. */
    historyContent?: string;
    /** Follow-ups are sent exactly as typed instead of being re-wrapped. */
    verbatim?: boolean;
    priorTurns: ChatTurn[];
    /** Continue a cut-off answer: append to the last assistant turn. */
    continueFrom?: string;
  }) => {
    if (!activeFile) return;

    setIsLoading(true);
    setError(null);
    setNotice(null);
    if (!input.continueFrom) setCutOff(false);

    const history = threadToMessages(input.priorTurns);

    const commit = (assistantText: string, engine: string) => {
      setEngineUsed(engine);
      const base = input.priorTurns;
      const next: ChatTurn[] = input.continueFrom
        ? [
            ...base.slice(0, -1),
            {
              role: "assistant",
              content: [base[base.length - 1]?.content || "", assistantText]
                .filter(Boolean)
                .join("\n\n"),
            },
          ]
        : [
            ...base,
            {
              role: "user",
              content: input.historyContent || input.display,
              display: input.display,
            },
            { role: "assistant", content: assistantText },
          ];
      const entry: ChatThread = {
        id: thread?.id || makeThreadId(),
        title: deriveTitle(next),
        updatedAt: Date.now(),
        turns: next,
      };
      setThread(entry);
      saveThread(entry);
    };

    // Offline: use the built-in assistant so the feature still works.
    if (!online) {
      const offlineResult = generateSmartCodeAssistance(
        input.action,
        activeFile.language,
        activeFile.content,
        input.prompt
      );
      commit(offlineResult, "Built-in assistant (offline)");
      setIsLoading(false);
      return;
    }

    try {
      const response = await generateAiAssistance(
        input.action,
        activeFile.language,
        activeFile.content,
        input.prompt,
        {
          systemPrompt: settings.systemPrompt,
          contextText,
          history,
          verbatimTask: input.verbatim,
          continueFrom: input.continueFrom,
        }
      );
      if (response.empty && !response.usedFallback) {
        const limit =
          response.maxResponseTokens === "model" ||
          response.maxResponseTokens === undefined
            ? "the Model default"
            : `${response.maxResponseTokens} tokens`;
        setNotice(
          `The model sent back an empty answer. Reasoning models often use up the whole limit (${limit}) while thinking, before writing anything. Open Settings → AI, raise “Max response tokens”, and ask again.`
        );
      }
      commit(response.result, response.engine);
      setCutOff(!response.empty && hitTokenLimit(response.finishReason));
      if (response.usedFallback) setConfigured(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI request failed.");
    } finally {
      setIsLoading(false);
    }
  };

  /** A quick action always begins a fresh conversation. */
  const runQuickAction = (selected: AIAction, task: string) => {
    setAction(selected);
    void sendTurn({
      action: selected,
      prompt: task,
      // Show the plain request; replay the full turn (code included) later.
      display: task,
      historyContent: turnTask(
        selected,
        activeFile?.language || "",
        activeFile?.content || "",
        task,
        contextEnabledNow
      ),
      verbatim: contextEnabledNow,
      priorTurns: [],
    });
  };

  /** The follow-up box: continues the thread when there is one. */
  const handleAsk = () => {
    const text = prompt.trim();
    if (!text || isLoading) return;
    const prior = turns;
    setPrompt("");
    void sendTurn({
      action: "custom",
      prompt: text,
      display: text,
      verbatim: true,
      priorTurns: prior,
    });
  };

  /** Ask the model to continue a reply that hit the token limit. */
  const handleContinue = () => {
    if (!thread || lastTurn?.role !== "assistant") return;
    void sendTurn({
      action: "custom",
      prompt: "",
      display: "",
      priorTurns: turns,
      continueFrom: lastTurn.content,
    });
  };

  /** Drop the last answer and ask the same question again. */
  const handleRegenerate = () => {
    if (!thread || isLoading) return;
    let i = turns.length - 1;
    while (i >= 0 && turns[i].role !== "user") i -= 1;
    if (i < 0) return;
    const userTurn = turns[i];
    void sendTurn({
      action: "custom",
      // The stored turn already carries the code when context is off.
      prompt: userTurn.content,
      display: userTurn.display || userTurn.content,
      historyContent: userTurn.content,
      verbatim: true,
      priorTurns: turns.slice(0, i),
    });
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-purple-900/50 text-purple-400 border border-purple-700/50 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-100 truncate">
                {thread ? thread.title : "AI Coding Assistant"}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {thread
                  ? "Keep asking follow-up questions below"
                  : "Views your code to help — it cannot edit or run anything"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {turnCount(thread) > 0 && (
              <button
                type="button"
                onClick={startNewChat}
                title="Start a new conversation"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                New chat
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => runQuickAction("complete", "Suggest next logical lines of code")}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                action === "complete"
                  ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Next Lines</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => runQuickAction("explain", "Explain this code")}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                action === "explain"
                  ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Explain</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => runQuickAction("fix", "Fix bugs and syntax issues")}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                action === "fix"
                  ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fix Bugs</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => runQuickAction("refactor", "Refactor and optimize")}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                action === "refactor"
                  ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span>Refactor</span>
            </button>
          </div>

          {/* Context preview + per-message toggle */}
          {settings.projectAccess !== "off" && contextResult.text.length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-800 bg-slate-900/60">
              <button
                type="button"
                role="switch"
                aria-checked={includeContext}
                onClick={() => setIncludeContext((v) => !v)}
                title="Include project context in each message"
                className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${
                  includeContext ? "bg-emerald-600 justify-end" : "bg-slate-700 justify-start"
                } flex items-center`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow" />
              </button>
              <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] text-slate-300 truncate">
                {includeContext
                  ? describeContext(contextResult)
                  : "Project context off for these messages"}
              </span>
            </div>
          )}
        </div>

        {(error || !configured) && (
          <div className="px-4 pt-3 space-y-2">
            {error && (
              <div className="p-3 rounded-xl border border-red-800/60 bg-red-950/40 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}
            {!configured && (
              <div className="p-3 rounded-xl border border-purple-800/50 bg-purple-950/30 text-xs text-purple-200 flex items-center justify-between gap-3">
                <span className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Using the built-in offline assistant. Add an AI connection
                    (OpenRouter, OpenAI, Claude, Gemini, a local server and more)
                    for real AI that understands your code.
                  </span>
                </span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold"
                  >
                    AI settings
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 bg-slate-950/60 min-h-[160px] space-y-3"
        >
          {turns.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full py-12 text-slate-500 text-xs text-center font-sans">
              Choose a quick action above or ask a question to get AI assistance
              for {activeFile?.name || "your code"}.
            </div>
          )}

          {turns.map((turn, index) =>
            turn.role === "user" ? (
              <div key={index} className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-purple-600/20 border border-purple-700/40 text-xs text-purple-100 whitespace-pre-wrap font-sans">
                  {turn.display || turn.content}
                </div>
              </div>
            ) : (
              <AssistantBubble
                key={index}
                text={turn.content}
                isLast={index === turns.length - 1}
                isBusy={isLoading}
                copied={copied}
                onCopy={handleCopy}
                onInsert={(code) => {
                  onInsertCode(code);
                  onClose();
                }}
                onReplace={(code) => {
                  onReplaceCode(code);
                  onClose();
                }}
              />
            )
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-sans px-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              {turns.length === 0 ? "Generating…" : "Thinking…"}
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-xl border border-amber-700/60 bg-amber-950/40 text-[11px] leading-relaxed text-amber-200 font-sans">
              {notice}
            </div>
          )}

          {cutOff && !isLoading && lastTurn?.role === "assistant" && (
            <div className="p-3 rounded-xl border border-amber-700/60 bg-amber-950/40 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-amber-200 font-sans">
                The answer stopped at the response-token limit.
              </span>
              <button
                type="button"
                onClick={handleContinue}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                Cut off - Continue
              </button>
            </div>
          )}

          {/* Follow-up suggestions after an answer */}
          {hasAnswer && !isLoading && (
            <div className="flex flex-wrap gap-2 pt-1 font-sans">
              {FOLLOW_UP_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={isLoading}
                  onClick={() =>
                    void sendTurn({
                      action: "custom",
                      prompt: chip,
                      display: chip,
                      verbatim: true,
                      priorTurns: turns,
                    })
                  }
                  className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Follow-up composer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-2">
          {hasAnswer && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-purple-400 font-semibold truncate">
                {engineUsed}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  className="flex items-center gap-1 hover:text-slate-200 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      turns
                        .filter((t) => t.role === "assistant")
                        .map((t) => t.content)
                        .join("\n\n"),
                      "all"
                    )
                  }
                  className="flex items-center gap-1 hover:text-slate-200"
                >
                  {copied === "all" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copied === "all" ? "Copied" : "Copy all"}</span>
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={
                hasAnswer
                  ? "Ask a follow-up…  e.g. 'make it faster'"
                  : "Ask about your code… e.g. 'add a binary search function'"
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAsk();
              }}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={isLoading || !prompt.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-right">
            Target: {activeFile?.name || "no file"} · last {MAX_SAVED_CHATS} chats
            are kept on this device
          </p>
        </div>
      </div>
    </div>
  );
};

function turnCount(thread: ChatThread | null): number {
  return thread ? thread.turns.length : 0;
}

interface AssistantBubbleProps {
  text: string;
  isLast: boolean;
  isBusy: boolean;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onInsert: (code: string) => void;
  onReplace: (code: string) => void;
}

const AssistantBubble: React.FC<AssistantBubbleProps> = ({
  text,
  isLast,
  isBusy,
  copied,
  onCopy,
  onInsert,
  onReplace,
}) => {
  const blocks = parseFencedBlocks(text);
  const hasText = text.trim().length > 0;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] space-y-2">
        {!hasText && (
          <p className="text-xs text-slate-500 font-sans italic">
            {isLast && isBusy ? "…" : "(no reply)"}
          </p>
        )}
        {blocks.map((block, bi) =>
          block.type === "code" ? (
            <div
              key={bi}
              className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/70 border-b border-slate-800">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 font-sans">
                  {block.lang || "code"}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => onCopy(block.content, `${bi}-code`)}
                    className="flex items-center gap-1 hover:text-slate-200"
                  >
                    {copied === `${bi}-code` ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copied === `${bi}-code` ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsert(block.content)}
                    className="flex items-center gap-1 hover:text-slate-200"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Insert</span>
                  </button>
                  {isLast && (
                    <button
                      type="button"
                      onClick={() => onReplace(block.content)}
                      className="flex items-center gap-1 hover:text-slate-200"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Replace file</span>
                    </button>
                  )}
                </div>
              </div>
              <pre className="p-3 text-[11px] leading-relaxed text-slate-200 overflow-x-auto font-mono whitespace-pre">
                {block.content}
              </pre>
            </div>
          ) : (
            <div
              key={bi}
              className="text-xs leading-relaxed text-slate-200 font-sans whitespace-pre-wrap"
            >
              {block.content}
            </div>
          )
        )}
      </div>
    </div>
  );
};
