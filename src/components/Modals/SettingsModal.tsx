"use client";

import React, { useEffect, useState } from "react";
import { EditorSettings } from "@/types";
import {
  Settings,
  X,
  Type,
  AlignLeft,
  Sparkles,
  Zap,
  Sliders,
  Check,
  KeyRound,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  AI_PROVIDERS,
  getAiConfig,
  saveAiConfig,
  clearAiKey,
  getProviderMeta,
  type AiProvider,
} from "@/lib/ai-client";

interface SettingsModalProps {
  isOpen: boolean;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  onClose: () => void;
}

const FONT_FAMILIES = [
  { label: "Fira Code", value: "'Fira Code', monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
  { label: "Menlo / Monaco", value: "Menlo, Monaco, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "System Monospace", value: "monospace" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">
              Editor Preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Typography Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Type className="w-3.5 h-3.5 text-blue-400" />
              <span>Typography & Sizing</span>
            </div>

            {/* Font Size */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Font Size</span>
                <span className="font-mono text-blue-400 font-bold">
                  {settings.fontSize}px
                </span>
              </div>
              <input
                type="range"
                min="11"
                max="26"
                step="1"
                value={settings.fontSize}
                onChange={(e) =>
                  onUpdateSettings({ fontSize: Number(e.target.value) })
                }
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Font Family */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
              <label className="text-xs text-slate-300 font-medium block">
                Font Family
              </label>
              <select
                value={settings.fontFamily}
                onChange={(e) =>
                  onUpdateSettings({ fontFamily: e.target.value })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Typing & Indentation Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Smart Indentation & Caret</span>
            </div>

            {/* Auto Indent Mode */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Smart Auto-Indentation
                </div>
                <div className="text-[11px] text-slate-400">
                  Auto-indent on Enter and brace matching
                </div>
              </div>
              <select
                value={settings.autoIndent}
                onChange={(e) =>
                  onUpdateSettings({ autoIndent: e.target.value as any })
                }
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
              >
                <option value="full">Full (Smartest)</option>
                <option value="advanced">Advanced</option>
                <option value="brackets">Brackets Only</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Smooth Caret Movement */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Smooth Caret Animation
                </div>
                <div className="text-[11px] text-slate-400">
                  Silky smooth cursor movement across characters
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    cursorSmoothCaretAnimation:
                      settings.cursorSmoothCaretAnimation === "on"
                        ? "off"
                        : "on",
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.cursorSmoothCaretAnimation === "on"
                    ? "bg-blue-600 justify-end"
                    : "bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>

            {/* Cursor Blinking Style */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Cursor Blinking
                </div>
                <div className="text-[11px] text-slate-400">
                  Blinking animation style for cursor
                </div>
              </div>
              <select
                value={settings.cursorBlinking}
                onChange={(e) =>
                  onUpdateSettings({ cursorBlinking: e.target.value as any })
                }
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
              >
                <option value="smooth">Smooth Fade</option>
                <option value="blink">Standard Blink</option>
                <option value="solid">Solid (No blink)</option>
              </select>
            </div>

            {/* Tab Size */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Tab Indent Size
                </div>
                <div className="text-[11px] text-slate-400">
                  Number of spaces per tab indentation
                </div>
              </div>
              <div className="flex gap-1.5">
                {[2, 4].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onUpdateSettings({ tabSize: size })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      settings.tabSize === size
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {size} spaces
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Editor Layout & Assists */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Layout & IntelliSense</span>
            </div>

            {/* Word Wrap */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Word Wrap
                </div>
                <div className="text-[11px] text-slate-400">
                  Wrap long lines horizontally to fit screen
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    wordWrap: settings.wordWrap === "on" ? "off" : "on",
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.wordWrap === "on"
                    ? "bg-blue-600 justify-end"
                    : "bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>

            {/* Minimap */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Code Minimap
                </div>
                <div className="text-[11px] text-slate-400">
                  Side minimap scroll overview
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ minimap: !settings.minimap })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.minimap
                    ? "bg-blue-600 justify-end"
                    : "bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  IntelliSense Autocomplete
                </div>
                <div className="text-[11px] text-slate-400">
                  Popup completions and suggestions while typing
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    quickSuggestions: !settings.quickSuggestions,
                  })
                }
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.quickSuggestions
                    ? "bg-blue-600 justify-end"
                    : "bg-slate-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          </div>

          {/* AI Assistant (bring your own key) */}
          <AiSettingsSection />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Bring-your-own-key AI setup. The key is stored encrypted on the device via
 * the secret store; only the provider/model choice is plain preference data.
 */
const AiSettingsSection: React.FC = () => {
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState(getProviderMeta("openai").defaultModel);
  const [keyInput, setKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async (nextProvider?: AiProvider) => {
    const config = await getAiConfig();
    const active = nextProvider || config.provider;
    setProvider(active);
    setModel(nextProvider ? getProviderMeta(active).defaultModel : config.model);
    setHasKey(nextProvider ? false : config.hasKey);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const meta = getProviderMeta(provider);

  const handleProviderChange = (next: AiProvider) => {
    setMessage(null);
    setKeyInput("");
    void refresh(next).then(() => setProvider(next));
  };

  const handleSave = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveAiConfig({ provider, model: model.trim() || meta.defaultModel, apiKey: keyInput });
      setKeyInput("");
      await refresh(provider);
      setMessage("Saved. The AI assistant will use your key from now on.");
    } catch {
      setMessage("Couldn't save the key. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await clearAiKey(provider);
      await refresh(provider);
      setMessage("Key removed. The editor falls back to the built-in offline assistant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        <span>AI Assistant (bring your own key)</span>
      </div>

      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300 font-medium">Provider</span>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              hasKey
                ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-300"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {hasKey ? "Key saved" : "Offline assistant"}
          </span>
        </div>

        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={meta.defaultModel}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">
            API key {hasKey ? "(saved — paste a new one to replace it)" : ""}
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={meta.keyPlaceholder}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            <span>Save key</span>
          </button>
          {hasKey && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300"
              title="Remove saved key"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {message && <p className="text-[11px] text-slate-400">{message}</p>}

        <div className="text-[11px] text-slate-400 space-y-1">
          <p>{meta.note}</p>
          <a
            href={meta.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-purple-400 hover:underline"
          >
            <span>Get a {meta.label} API key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <p className="text-slate-500">
            Your key is stored encrypted on this device and sent only to the provider.
          </p>
        </div>
      </div>
    </div>
  );
};
