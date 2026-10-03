"use client";

import React, { useEffect, useRef, useState } from "react";
import { FileItem } from "@/types";
import { X, Plus, FileCode, FileText, Globe, Hash, Lock } from "lucide-react";

interface TabBarProps {
  files: FileItem[];
  openFileIds: string[];
  activeFileId: string;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  /** Called instead of onCloseTab when the tab has unsaved changes. */
  onRequestCloseDirty?: (file: FileItem) => void;
  onNewFile: () => void;
  accentColor?: string;
}

const CONFIRM_MS = 2500;

export const TabBar: React.FC<TabBarProps> = ({
  files,
  openFileIds,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onRequestCloseDirty,
  onNewFile,
  accentColor = "#38bdf8",
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which tab is currently showing the small red "Close?" chip.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const openFiles = files.filter((f) => openFileIds.includes(f.id) && !f.isFolder);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const armConfirm = (fileId: string) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(fileId);
    // If the user ignores the chip, it quietly reverts.
    confirmTimer.current = setTimeout(() => {
      setConfirmingId((current) => (current === fileId ? null : current));
    }, CONFIRM_MS);
  };

  const confirmClose = (file: FileItem) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(null);
    if (file.isDirty && !file.readOnly && onRequestCloseDirty) {
      onRequestCloseDirty(file);
    } else {
      onCloseTab(file.id);
    }
  };

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
          const isConfirming = confirmingId === file.id;
          return (
            <div
              key={file.id}
              onClick={() => {
                if (isConfirming) setConfirmingId(null);
                onSelectTab(file.id);
              }}
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

              {file.readOnly && (
                <Lock
                  className="w-3 h-3 text-slate-500 shrink-0"
                  aria-label="Read-only example file"
                />
              )}

              {/* Dirty Unsaved Dot */}
              {file.isDirty && !file.readOnly && (
                <span
                  className="w-2 h-2 rounded-full bg-blue-400 shrink-0"
                  title="Unsaved changes"
                />
              )}

              {/* Close control — first tap arms a small "Close?" chip. */}
              {isConfirming ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmClose(file);
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none hover:bg-red-400 transition-colors"
                  title="Tap again to close"
                >
                  Close?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    armConfirm(file.id);
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-700/80 text-slate-500 hover:text-slate-200 opacity-60 group-hover:opacity-100 transition-opacity ml-1"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* New File Tab Button */}
        <button
          type="button"
          onClick={onNewFile}
          title="New blank file"
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
