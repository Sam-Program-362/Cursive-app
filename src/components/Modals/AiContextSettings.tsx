"use client";

import React, { useEffect, useState } from "react";
import { Brain, RotateCcw, FolderTree, EyeOff, Gauge } from "lucide-react";
import {
  DEFAULT_SYSTEM_PROMPT,
  loadAiSettings,
  resetSystemPrompt,
  saveAiSettings,
  type ProjectAccess,
} from "@/lib/ai-context";
import {
  CONTEXT_TOKEN_CHOICES,
  DEFAULT_TOKEN_LIMITS,
  RESPONSE_TOKEN_CHOICES,
  loadTokenLimits,
  saveTokenLimits,
  type TokenLimits,
} from "@/lib/ai-connections";

const ACCESS_LEVELS: {
  id: ProjectAccess;
  label: string;
  hint: string;
}[] = [
  {
    id: "off",
    label: "Off",
    hint: "Send only the code the action needs. No project files.",
  },
  {
    id: "file",
    label: "Current file",
    hint: "Also send the open file (with line numbers), your selection and the last run output.",
  },
  {
    id: "project",
    label: "Whole project",
    hint: "Also send the file list and the other project files (within a size budget).",
  },
];

export const AiContextSettings: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [projectAccess, setProjectAccess] = useState<ProjectAccess>("off");
  const [savedNote, setSavedNote] = useState(false);
  const [limits, setLimits] = useState<TokenLimits>({ ...DEFAULT_TOKEN_LIMITS });

  useEffect(() => {
    const settings = loadAiSettings();
    setSystemPrompt(settings.systemPrompt);
    setProjectAccess(settings.projectAccess);
    setLimits(loadTokenLimits());
  }, []);

  const updateLimits = (patch: Partial<TokenLimits>) => {
    setLimits((prev) => ({ ...prev, ...patch }));
    saveTokenLimits(patch);
  };

  const updatePrompt = (value: string) => {
    setSystemPrompt(value);
    saveAiSettings({ systemPrompt: value });
  };

  const updateAccess = (value: ProjectAccess) => {
    setProjectAccess(value);
    saveAiSettings({ projectAccess: value });
  };

  const handleReset = () => {
    const prompt = resetSystemPrompt();
    setSystemPrompt(prompt);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
        <Brain className="w-3.5 h-3.5 text-cyan-400" />
        <span>AI instructions & context</span>
      </div>

      {/* System prompt */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300 font-medium">
            System prompt
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{savedNote ? "Reset" : "Reset to default"}</span>
          </button>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => updatePrompt(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-[11px] leading-relaxed text-slate-100 font-mono focus:outline-none focus:border-cyan-500 resize-y"
        />
        <p className="text-[10px] text-slate-500">
          Saved automatically. The default tells the assistant it runs inside a
          mobile, offline editor with on-device CPython and no pip.
        </p>
      </div>

      {/* Project access */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
        <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
          <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
          Project access
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {ACCESS_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => updateAccess(level.id)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                projectAccess === level.id
                  ? "border-emerald-500 bg-emerald-950/40 text-emerald-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          {ACCESS_LEVELS.find((l) => l.id === projectAccess)?.hint}
        </p>
        <div className="flex items-start gap-1.5 text-[10px] text-slate-500">
          <EyeOff className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Secret files (.env, keys, tokens) and anything that looks like an API
            key are never sent. The assistant can only view — it cannot edit,
            run or delete files.
          </span>
        </div>
      </div>

      {/* Token limits (global defaults) */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
        <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          Token limits
        </label>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Max response tokens
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              {limits.maxResponseTokens === "model"
                ? "Model default"
                : limits.maxResponseTokens}
            </span>
          </div>
          <select
            value={String(limits.maxResponseTokens)}
            onChange={(e) =>
              updateLimits({
                maxResponseTokens:
                  e.target.value === "model"
                    ? "model"
                    : Number(e.target.value),
              })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          >
            <option value="model">Model default (provider decides)</option>
            {RESPONSE_TOKEN_CHOICES.map((value) => (
              <option key={value} value={value}>
                {value} tokens
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500">
            How long one answer may be (256–16384). Raise it if replies stop
            early — or pick Model default and let the provider decide.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Max context tokens
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              {limits.maxContextTokens}
            </span>
          </div>
          <select
            value={String(limits.maxContextTokens)}
            onChange={(e) =>
              updateLimits({ maxContextTokens: Number(e.target.value) })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          >
            {!CONTEXT_TOKEN_CHOICES.includes(limits.maxContextTokens) && (
              <option value={limits.maxContextTokens}>
                {limits.maxContextTokens} tokens
              </option>
            )}
            {CONTEXT_TOKEN_CHOICES.map((value) => (
              <option key={value} value={value}>
                {value} tokens
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500">
            Chat history plus the attached project context share this budget.
            When it fills up, the oldest messages are dropped first.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Temperature</span>
            <span className="text-[11px] font-mono text-amber-300">
              {limits.temperature === null
                ? "Provider default"
                : limits.temperature.toFixed(1)}
            </span>
          </div>
          <select
            value={limits.temperature === null ? "default" : String(limits.temperature)}
            onChange={(e) =>
              updateLimits({
                temperature:
                  e.target.value === "default" ? null : Number(e.target.value),
              })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          >
            <option value="default">Provider default</option>
            {[0, 0.3, 0.5, 0.7, 1, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value.toFixed(1)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500">
            Lower = more focused, higher = more creative. Optional — leave it
            on Provider default unless you have a reason.
          </p>
        </div>

        <p className="text-[10px] text-slate-500">
          These are the global defaults. A connection can override them in
          Settings → AI connections → edit → Token limits.
        </p>
      </div>
    </div>
  );
};
