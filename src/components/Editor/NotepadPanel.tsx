"use client";

import React, { useState, useEffect } from "react";
import { FileItem } from "@/types";
import {
  StickyNote,
  X,
  CheckSquare,
  FileText,
  Eye,
  Edit3,
  ListPlus,
  Sparkles,
} from "lucide-react";

interface NotepadPanelProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveNotes: (fileId: string, notes: string) => void;
}

export const NotepadPanel: React.FC<NotepadPanelProps> = ({
  file,
  isOpen,
  onClose,
  onSaveNotes,
}) => {
  const [notes, setNotes] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (file) {
      setNotes(file.notes || "");
    } else {
      setNotes("");
    }
  }, [file?.id, file?.notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    if (file) {
      onSaveNotes(file.id, val);
    }
  };

  const insertTodoItem = () => {
    const todoTemplate = "\n- [ ] ";
    const updated = notes + todoTemplate;
    setNotes(updated);
    if (file) onSaveNotes(file.id, updated);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 md:w-88 flex flex-col h-full bg-slate-900 border-l border-slate-800 shadow-2xl transition-all duration-200 z-20 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="truncate">
            <span className="text-xs font-semibold text-slate-200">
              Notepad
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {file?.name ? `Notes for ${file.name}` : "No file selected"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Todo Button */}
          <button
            type="button"
            onClick={insertTodoItem}
            title="Add Todo checkbox"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
          >
            <ListPlus className="w-4 h-4" />
          </button>

          {/* Toggle Preview Button */}
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            title={previewMode ? "Edit Markdown" : "Preview Markdown"}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-300 transition-colors"
          >
            {previewMode ? (
              <Edit3 className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Notepad"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notepad Body */}
      <div className="flex-1 p-3 flex flex-col overflow-hidden bg-slate-950/40">
        {file ? (
          previewMode ? (
            <div className="flex-1 overflow-y-auto p-2 bg-slate-900/60 rounded border border-slate-800/80 text-xs text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
              {notes.trim() ? (
                notes
              ) : (
                <span className="text-slate-600 italic">No notes yet...</span>
              )}
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={handleChange}
              placeholder={`Scratchpad notes for ${file.name}...\n\nIdeas, todos, reminders, or scratch code.\nSaved automatically and won't affect execution!`}
              className="flex-1 w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/50 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none font-mono leading-relaxed transition-colors shadow-inner"
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-slate-500 text-center">
            Open a file to create and edit its notes
          </div>
        )}
      </div>

      {/* Footer / Status */}
      <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>{notes.length} characters</span>
        <span className="text-amber-400/80 font-medium">Auto-saved to DB</span>
      </div>
    </div>
  );
};
