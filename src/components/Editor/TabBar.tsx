"use client";

import React, { useRef } from "react";
import { FileItem } from "@/types";
import { X, Plus, FileCode, FileText, Globe, Hash, Sparkles } from "lucide-react";

interface TabBarProps {
  files: FileItem[];
  openFileIds: string[];
  activeFileId: string;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onNewFile: () => void;
  accentColor?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  files,
  openFileIds,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onNewFile,
  accentColor = "#38bdf8",
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const openFiles = files.filter((f) => openFileIds.includes(f.id) && !f.isFolder);

  const getFileIcon = (lang: string, name: string) => {
    if (name.endsWith(".html") || lang === "html") {
      return <Globe className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    }
    if (name.endsWith(".css") || lang === "css") {
      return <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (name.endsWith(".py") || lang === "python") {
      return <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    }
    if (name.endsWith(".js") || name.endsWith(".ts") || lang === "javascript" || lang === "typescript") {
      return <FileCode className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    }
    return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  return (
    <div className="flex items-center bg-slate-900/90 border-b border-slate-800/80 select-none overflow-hidden h-9 px-1">
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 h-full py-0.5"
      >
        {openFiles.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <div
              key={file.id}
              onClick={() => onSelectTab(file.id)}
              className={`group relative flex items-center gap-1.5 px-3 h-8 text-xs rounded-t-md transition-all cursor-pointer border-t-2 shrink-0 ${
                isActive
                  ? "bg-slate-950 text-slate-100 font-medium border-t-blue-500 shadow-sm"
                  : "bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-t-transparent"
              }`}
              style={{
                borderTopColor: isActive ? accentColor : "transparent",
              }}
            >
              {getFileIcon(file.language, file.name)}

              <span className="truncate max-w-[130px]">{file.name}</span>

              {/* Dirty Unsaved Dot */}
              {file.isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-blue-400 shrink-0"
                  title="Unsaved changes"
                />
              )}

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.id);
                }}
                className="p-0.5 rounded-full hover:bg-slate-700/80 text-slate-500 hover:text-slate-200 opacity-60 group-hover:opacity-100 transition-opacity ml-1"
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* New File Tab Button */}
        <button
          type="button"
          onClick={onNewFile}
          title="Create new file"
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
