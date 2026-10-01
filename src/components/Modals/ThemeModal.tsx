"use client";

import React, { useState } from "react";
import { BuiltinThemeId, CustomThemeColors, EditorSettings } from "@/types";
import { THEMES } from "@/lib/themes";
import { X, Check, Palette, Sparkles, Sliders } from "lucide-react";

interface ThemeModalProps {
  isOpen: boolean;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  onClose: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"preset" | "custom">("preset");
  const [customColors, setCustomColors] = useState<CustomThemeColors>(
    settings.customTheme
  );

  if (!isOpen) return null;

  const handleSelectPreset = (themeId: BuiltinThemeId) => {
    onUpdateSettings({ theme: themeId });
  };

  const handleCustomColorChange = (key: keyof CustomThemeColors, val: string) => {
    const updated = { ...customColors, [key]: val };
    setCustomColors(updated);
    onUpdateSettings({
      theme: "custom",
      customTheme: updated,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">Editor Theme & Colors</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("preset")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "preset"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Built-in Themes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "custom"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Custom Theme Builder
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "preset" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(THEMES)
                .filter(([id]) => id !== "custom")
                .map(([id, theme]) => {
                  const isSelected = settings.theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectPreset(id as BuiltinThemeId)}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/30 shadow-lg scale-[1.02]"
                          : "border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {theme.name}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </div>

                      {/* Color swatch preview */}
                      <div className="flex items-center gap-1.5 w-full">
                        <div
                          className="w-4 h-4 rounded-full border border-slate-700"
                          style={{ backgroundColor: theme.uiBg }}
                          title="Background"
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-slate-700"
                          style={{ backgroundColor: theme.uiSidebar }}
                          title="Sidebar"
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-slate-700"
                          style={{ backgroundColor: theme.accent }}
                          title="Accent"
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-slate-700"
                          style={{ backgroundColor: theme.uiText }}
                          title="Text"
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : (
            /* Custom Theme Builder */
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Customize your individual workspace colors. Changes update the editor and interface in real time.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorPickerField
                  label="App Background"
                  value={customColors.background}
                  onChange={(v) => handleCustomColorChange("background", v)}
                />
                <ColorPickerField
                  label="Editor Background"
                  value={customColors.editorBg}
                  onChange={(v) => handleCustomColorChange("editorBg", v)}
                />
                <ColorPickerField
                  label="Sidebar Background"
                  value={customColors.sidebarBg}
                  onChange={(v) => handleCustomColorChange("sidebarBg", v)}
                />
                <ColorPickerField
                  label="Accent Color"
                  value={customColors.accent}
                  onChange={(v) => handleCustomColorChange("accent", v)}
                />
                <ColorPickerField
                  label="Text Color"
                  value={customColors.foreground}
                  onChange={(v) => handleCustomColorChange("foreground", v)}
                />
                <ColorPickerField
                  label="Cursor Color"
                  value={customColors.cursorColor}
                  onChange={(v) => handleCustomColorChange("cursorColor", v)}
                />
              </div>

              {/* Live Preview Box */}
              <div
                className="p-4 rounded-xl border transition-all mt-4"
                style={{
                  backgroundColor: customColors.editorBg,
                  borderColor: customColors.accent,
                  color: customColors.foreground,
                }}
              >
                <div className="text-[11px] font-mono opacity-60 mb-1">
                  Preview:
                </div>
                <div className="font-mono text-xs">
                  <span style={{ color: customColors.accent }}>function</span>{" "}
                  greet() {"{"}
                  <br />
                  &nbsp;&nbsp;console.log(
                  <span style={{ color: "#34d399" }}>"Hello CodePad!"</span>);
                  <br />
                  {"}"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-slate-400 uppercase">
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
        />
      </div>
    </div>
  );
};
