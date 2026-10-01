"use client";

import React from "react";
import { Project, FileItem } from "@/types";
import {
  Play,
  Sparkles,
  Sidebar as SidebarIcon,
  StickyNote,
  Terminal,
  Palette,
  Settings,
  Github,
  Download,
  Check,
  Cloud,
  Layers,
  Code2,
  FolderOpen,
} from "lucide-react";

interface TopNavbarProps {
  project: Project | null;
  activeFile: FileItem | null;
  isRunning: boolean;
  saveStatus: "saved" | "saving" | "unsaved";
  isSidebarOpen: boolean;
  isNotepadOpen: boolean;
  isConsoleOpen: boolean;
  onToggleSidebar: () => void;
  onToggleNotepad: () => void;
  onToggleConsole: () => void;
  onRun: () => void;
  onOpenAI: () => void;
  onOpenTheme: () => void;
  onOpenSettings: () => void;
  onOpenGitHub: () => void;
  onOpenTemplates: () => void;
  onExportZip: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  project,
  activeFile,
  isRunning,
  saveStatus,
  isSidebarOpen,
  isNotepadOpen,
  isConsoleOpen,
  onToggleSidebar,
  onToggleNotepad,
  onToggleConsole,
  onRun,
  onOpenAI,
  onOpenTheme,
  onOpenSettings,
  onOpenGitHub,
  onOpenTemplates,
  onExportZip,
}) => {
  return (
    <header className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 select-none shrink-0 z-30">
      {/* Left: Brand & Sidebar toggle */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? "Hide File Sidebar" : "Show File Sidebar"}
          className={`p-1.5 rounded-lg transition-colors ${
            isSidebarOpen
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          <SidebarIcon className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 font-black text-sm text-slate-100 tracking-tight shrink-0">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Code2 className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-white via-slate-200 to-blue-400 bg-clip-text text-transparent">
              CodePad
            </span>
          </div>

          <span className="text-slate-700 hidden sm:inline">|</span>

          {/* Project & File Title */}
          <div className="flex items-center gap-1.5 min-w-0 truncate text-xs">
            <button
              type="button"
              onClick={onOpenTemplates}
              title="Switch project / template"
              className="flex items-center gap-1 text-slate-400 hover:text-slate-100 hover:underline truncate max-w-[120px] sm:max-w-[180px]"
            >
              <FolderOpen className="w-3 h-3 shrink-0" />
              <span className="truncate">{project?.name || "Workspace"}</span>
            </button>
            {activeFile && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-blue-400 font-mono font-medium truncate max-w-[100px] sm:max-w-[140px]">
                  {activeFile.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Save & Sync Status */}
      <div className="hidden lg:flex items-center gap-2 text-xs">
        {saveStatus === "saving" ? (
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Saving...
          </span>
        ) : saveStatus === "unsaved" ? (
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Unsaved changes
          </span>
        ) : (
          <span className="flex items-center gap-1 text-emerald-400">
            <Check className="w-3 h-3" />
            Saved
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Run Button */}
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          title="Run Code (Ctrl+Enter)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>{isRunning ? "Running..." : "Run"}</span>
        </button>

        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={onOpenAI}
          title="AI Assistant (Ctrl+I)"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>AI</span>
        </button>

        {/* Console Toggle */}
        <button
          type="button"
          onClick={onToggleConsole}
          title={isConsoleOpen ? "Hide Console" : "Show Console"}
          className={`p-1.5 rounded-lg transition-colors ${
            isConsoleOpen
              ? "bg-slate-800 text-blue-400 border border-slate-700"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          <Terminal className="w-4 h-4" />
        </button>

        {/* Notepad Toggle */}
        <button
          type="button"
          onClick={onToggleNotepad}
          title={isNotepadOpen ? "Hide File Notepad" : "Show File Notepad"}
          className={`relative p-1.5 rounded-lg transition-colors ${
            isNotepadOpen
              ? "bg-amber-950/40 text-amber-400 border border-amber-800/50"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          <StickyNote className="w-4 h-4" />
          {activeFile?.notes && activeFile.notes.trim().length > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        {/* GitHub Sync */}
        <button
          type="button"
          onClick={onOpenGitHub}
          title="Push / Pull from GitHub"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <Github className="w-4 h-4" />
        </button>

        {/* Export ZIP */}
        <button
          type="button"
          onClick={onExportZip}
          title="Download Workspace as ZIP"
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Theme Picker */}
        <button
          type="button"
          onClick={onOpenTheme}
          title="Theme & Colors"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <Palette className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Preferences & Typography"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
