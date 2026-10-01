"use client";

import React, { useState } from "react";
import { FileItem } from "@/types";
import {
  Sparkles,
  X,
  Play,
  Copy,
  Check,
  FileCode,
  ArrowRight,
  Lightbulb,
  Wrench,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface AIModalProps {
  isOpen: boolean;
  activeFile: FileItem | null;
  onClose: () => void;
  onInsertCode: (code: string) => void;
  onReplaceCode: (code: string) => void;
}

export const AIModal: React.FC<AIModalProps> = ({
  isOpen,
  activeFile,
  onClose,
  onInsertCode,
  onReplaceCode,
}) => {
  const [prompt, setPrompt] = useState("");
  const [action, setAction] = useState<"complete" | "explain" | "fix" | "refactor" | "custom">("complete");
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [engineUsed, setEngineUsed] = useState<string>("");

  if (!isOpen) return null;

  const handleGenerate = async (selectedAction = action, customPrompt = prompt) => {
    if (!activeFile) return;

    setIsLoading(true);
    setAiResult(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedAction,
          language: activeFile.language,
          code: activeFile.content,
          prompt: customPrompt,
        }),
      });

      const data = await res.json();
      if (data.result) {
        setAiResult(data.result);
        setEngineUsed(data.engine || "AI Assistant");
      } else {
        setAiResult(data.error || "Failed to generate AI response.");
      }
    } catch (err: any) {
      setAiResult("Error calling AI service: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-900/50 text-purple-400 border border-purple-700/50">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                AI Coding Assistant
              </h2>
              <p className="text-[11px] text-slate-400">
                Smart on-demand completions, explanations & refactoring
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setAction("complete");
                handleGenerate("complete", "Suggest next logical lines of code");
              }}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
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
              onClick={() => {
                setAction("explain");
                handleGenerate("explain", "Explain this code");
              }}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
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
              onClick={() => {
                setAction("fix");
                handleGenerate("fix", "Fix bugs and syntax issues");
              }}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
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
              onClick={() => {
                setAction("refactor");
                handleGenerate("refactor", "Refactor and optimize");
              }}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                action === "refactor"
                  ? "border-purple-500 bg-purple-950/40 text-purple-200 shadow"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span>Refactor</span>
            </button>
          </div>

          {/* Custom Instruction Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Or type custom prompt: e.g. 'Add a binary search function'..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGenerate("custom", prompt);
              }}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={() => handleGenerate("custom", prompt)}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Ask
            </button>
          </div>
        </div>

        {/* AI Output Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/60 font-mono text-xs text-slate-200 min-h-[160px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="text-xs">Generating smart suggestion...</span>
            </div>
          ) : aiResult ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                <span className="text-purple-400 font-sans font-semibold">
                  ⚡ Generated with {engineUsed}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed text-slate-200 p-2 bg-slate-900/70 rounded-lg border border-slate-800">
                {aiResult}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full py-12 text-slate-500 text-xs text-center font-sans">
              Choose a quick action above or enter a prompt to get AI assistance for {activeFile?.name || "your code"}.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {aiResult && (
          <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Target: {activeFile?.name}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onInsertCode(aiResult);
                  onClose();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
              >
                Insert at Cursor
              </button>
              <button
                type="button"
                onClick={() => {
                  onReplaceCode(aiResult);
                  onClose();
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Replace File Content
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
