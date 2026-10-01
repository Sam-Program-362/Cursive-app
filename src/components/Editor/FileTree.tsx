"use client";

import React, { useState } from "react";
import { FileItem, Project } from "@/types";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Globe,
  Hash,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  StickyNote,
  MoreVertical,
  X,
  Sparkles,
} from "lucide-react";

interface FileTreeProps {
  project: Project | null;
  files: FileItem[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (name: string, isFolder: boolean, parentId?: string | null) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onDeleteFile: (fileId: string) => void;
  onCloseSidebar?: () => void;
  onOpenTemplates?: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  project,
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onCloseSidebar,
  onOpenTemplates,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleStartRename = (file: FileItem) => {
    setEditingFileId(file.id);
    setEditingName(file.name);
  };

  const handleConfirmRename = () => {
    if (editingFileId && editingName.trim()) {
      onRenameFile(editingFileId, editingName.trim());
    }
    setEditingFileId(null);
  };

  const handleConfirmCreate = () => {
    if (newItemName.trim() && isCreating) {
      onCreateFile(newItemName.trim(), isCreating === "folder", targetParentId);
    }
    setIsCreating(null);
    setNewItemName("");
    setTargetParentId(null);
  };

  const getFileIcon = (file: FileItem) => {
    if (file.isFolder) {
      const isExpanded = !collapsedFolders[file.id];
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
      );
    }

    const name = file.name.toLowerCase();
    if (name.endsWith(".html") || file.language === "html") {
      return <Globe className="w-4 h-4 text-orange-400 shrink-0" />;
    }
    if (name.endsWith(".css") || file.language === "css") {
      return <Hash className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (name.endsWith(".py") || file.language === "python") {
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    }
    if (
      name.endsWith(".js") ||
      name.endsWith(".ts") ||
      name.endsWith(".jsx") ||
      name.endsWith(".tsx") ||
      file.language === "javascript"
    ) {
      return <FileCode className="w-4 h-4 text-amber-300 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Organize root files and nested files
  const rootFiles = files.filter(
    (f) => (!f.parentId || f.parentId === "root") && f.projectId === project?.id
  );

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border-r border-slate-800/80 select-none text-slate-200">
      {/* Header / Project Title */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <span className="font-semibold text-xs text-slate-200 truncate uppercase tracking-wider">
            {project?.name || "Workspace"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* New File Button */}
          <button
            type="button"
            onClick={() => {
              setIsCreating("file");
              setTargetParentId(null);
            }}
            title="New File"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* New Folder Button */}
          <button
            type="button"
            onClick={() => {
              setIsCreating("folder");
              setTargetParentId(null);
            }}
            title="New Folder"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {/* Mobile close sidebar button */}
          {onCloseSidebar && (
            <button
              type="button"
              onClick={onCloseSidebar}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 md:hidden"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Creation inline prompt */}
      {isCreating && (
        <div className="p-2 bg-slate-800/80 border-b border-slate-700/60 animate-fadeIn">
          <div className="text-[11px] text-slate-400 mb-1">
            Create New {isCreating === "file" ? "File" : "Folder"}:
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              autoFocus
              placeholder={isCreating === "file" ? "e.g. app.py" : "e.g. components"}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmCreate();
                if (e.key === "Escape") setIsCreating(null);
              }}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              type="button"
              onClick={handleConfirmCreate}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(null)}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {rootFiles.map((file) => (
          <FileNode
            key={file.id}
            file={file}
            allFiles={files}
            activeFileId={activeFileId}
            collapsedFolders={collapsedFolders}
            editingFileId={editingFileId}
            editingName={editingName}
            setEditingName={setEditingName}
            onSelectFile={onSelectFile}
            onToggleFolder={toggleFolder}
            onStartRename={handleStartRename}
            onConfirmRename={handleConfirmRename}
            onDeleteFile={onDeleteFile}
            getFileIcon={getFileIcon}
            depth={0}
          />
        ))}

        {rootFiles.length === 0 && (
          <div className="text-center py-8 px-4 text-slate-500 text-xs">
            <p>No files in workspace</p>
            <button
              type="button"
              onClick={() => setIsCreating("file")}
              className="mt-2 text-blue-400 hover:underline"
            >
              + Create first file
            </button>
          </div>
        )}
      </div>

      {/* Templates / Starter button at bottom */}
      {onOpenTemplates && (
        <div className="p-2 border-t border-slate-800/80 bg-slate-900/40">
          <button
            type="button"
            onClick={onOpenTemplates}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-xs text-slate-300 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Starter Templates
          </button>
        </div>
      )}
    </div>
  );
};

interface FileNodeProps {
  file: FileItem;
  allFiles: FileItem[];
  activeFileId: string;
  collapsedFolders: Record<string, boolean>;
  editingFileId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onSelectFile: (fileId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onStartRename: (file: FileItem) => void;
  onConfirmRename: () => void;
  onDeleteFile: (fileId: string) => void;
  getFileIcon: (file: FileItem) => React.ReactNode;
  depth: number;
}

const FileNode: React.FC<FileNodeProps> = ({
  file,
  allFiles,
  activeFileId,
  collapsedFolders,
  editingFileId,
  editingName,
  setEditingName,
  onSelectFile,
  onToggleFolder,
  onStartRename,
  onConfirmRename,
  onDeleteFile,
  getFileIcon,
  depth,
}) => {
  const isSelected = file.id === activeFileId;
  const isEditing = editingFileId === file.id;
  const isFolder = file.isFolder;
  const isCollapsed = collapsedFolders[file.id];
  const children = allFiles.filter((f) => f.parentId === file.id);
  const hasNotes = Boolean(file.notes && file.notes.trim().length > 0);

  return (
    <div>
      <div
        onClick={() => {
          if (isFolder) {
            onToggleFolder(file.id);
          } else {
            onSelectFile(file.id);
          }
        }}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
          isSelected
            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium"
            : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder && (
          <span className="text-slate-500">
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </span>
        )}

        {getFileIcon(file)}

        {isEditing ? (
          <input
            type="text"
            autoFocus
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={onConfirmRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmRename();
              if (e.key === "Escape") setEditingName(file.name);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-xs text-slate-100 focus:outline-none font-mono"
          />
        ) : (
          <span className="truncate flex-1 font-mono text-[11px]">{file.name}</span>
        )}

        {/* Notepad Indicator Badge */}
        {hasNotes && !isFolder && (
          <span className="shrink-0 flex" title="Has attached notes">
            <StickyNote className="w-3 h-3 text-amber-400" />
          </span>
        )}

        {/* File Actions */}
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartRename(file);
            }}
            title="Rename"
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete ${file.name}?`)) {
                onDeleteFile(file.id);
              }
            }}
            title="Delete"
            className="p-1 rounded hover:bg-red-900/50 text-slate-400 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Render children if folder is open */}
      {isFolder && !isCollapsed && (
        <div className="space-y-0.5">
          {children.map((child) => (
            <FileNode
              key={child.id}
              file={child}
              allFiles={allFiles}
              activeFileId={activeFileId}
              collapsedFolders={collapsedFolders}
              editingFileId={editingFileId}
              editingName={editingName}
              setEditingName={setEditingName}
              onSelectFile={onSelectFile}
              onToggleFolder={onToggleFolder}
              onStartRename={onStartRename}
              onConfirmRename={onConfirmRename}
              onDeleteFile={onDeleteFile}
              getFileIcon={getFileIcon}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
