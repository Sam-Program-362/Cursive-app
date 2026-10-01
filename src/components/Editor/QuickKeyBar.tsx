"use client";

import React from "react";
import {
  CornerDownLeft,
  Indent,
  Outdent,
  Undo,
  Redo,
  Sparkles,
} from "lucide-react";

interface QuickKeyBarProps {
  onInsertText: (text: string) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAI: () => void;
}

const QUICK_KEYS = [
  { label: "Tab", insert: "\t" },
  { label: "{ }", insert: "{}" },
  { label: "( )", insert: "()" },
  { label: "[ ]", insert: "[]" },
  { label: '" "', insert: '""' },
  { label: "' '", insert: "''" },
  { label: ":", insert: ":" },
  { label: ";", insert: ";" },
  { label: "=", insert: " = " },
  { label: "==", insert: " == " },
  { label: "=>", insert: " => " },
  { label: "->", insert: " -> " },
  { label: "+", insert: " + " },
  { label: "-", insert: " - " },
  { label: "*", insert: "*" },
  { label: "/", insert: "/" },
  { label: ".", insert: "." },
  { label: ",", insert: ", " },
  { label: "_", insert: "_" },
  { label: "#", insert: "# " },
  { label: "$", insert: "$" },
  { label: "!", insert: "!" },
  { label: "?", insert: "?" },
  { label: "<", insert: "<" },
  { label: ">", insert: ">" },
  { label: "|", insert: "|" },
  { label: "&", insert: "&" },
  { label: "\\", insert: "\\" },
];

export const QuickKeyBar: React.FC<QuickKeyBarProps> = ({
  onInsertText,
  onIndent,
  onOutdent,
  onUndo,
  onRedo,
  onOpenAI,
}) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1 px-2 border-t border-b border-slate-800/80 bg-slate-900/95 backdrop-blur text-xs select-none no-scrollbar shadow-inner z-10">
      {/* Indent / Outdent Controls */}
      <button
        type="button"
        onClick={onOutdent}
        title="Outdent block (Shift+Tab)"
        className="flex items-center gap-0.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all shrink-0 font-mono text-[11px] border border-slate-700/50"
      >
        <Outdent className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={onIndent}
        title="Indent block (Tab)"
        className="flex items-center gap-0.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all shrink-0 font-mono text-[11px] border border-slate-700/50"
      >
        <Indent className="w-3.5 h-3.5" />
      </button>

      {/* Undo / Redo */}
      <button
        type="button"
        onClick={onUndo}
        title="Undo"
        className="flex items-center px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all shrink-0 border border-slate-700/50"
      >
        <Undo className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onRedo}
        title="Redo"
        className="flex items-center px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all shrink-0 border border-slate-700/50"
      >
        <Redo className="w-3.5 h-3.5" />
      </button>

      {/* AI Quick Button */}
      <button
        type="button"
        onClick={onOpenAI}
        title="Ask AI to complete or fix code"
        className="flex items-center gap-1 px-2 py-1 rounded bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 active:scale-95 transition-all shrink-0 border border-purple-500/30 text-[11px] font-semibold"
      >
        <Sparkles className="w-3 h-3 text-purple-400" />
        AI
      </button>

      <div className="w-[1px] h-4 bg-slate-700 shrink-0 mx-0.5" />

      {/* Quick Insert Characters */}
      {QUICK_KEYS.map((key, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onInsertText(key.insert)}
          className="px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 active:bg-blue-600 active:text-white text-slate-200 transition-all font-mono text-[12px] font-medium shrink-0 border border-slate-700/40"
        >
          {key.label}
        </button>
      ))}
    </div>
  );
};
