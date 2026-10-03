"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  Folder,
  FileText,
  ChevronUp,
  HardDrive,
  Loader2,
  AlertCircle,
  FolderPlus,
  ShieldCheck,
  Save,
} from "lucide-react";
import {
  hasDeviceAccess,
  requestDeviceAccess,
  getDevicePaths,
  listDeviceDir,
  readDeviceText,
  makeDeviceDir,
  isDeviceFilesAvailable,
  joinDevicePath,
  type DeviceAccess,
  type DeviceEntry,
  type DeviceFile,
} from "@/lib/device-files";

interface DeviceFilesModalProps {
  isOpen: boolean;
  mode: "open" | "save";
  defaultFileName?: string;
  onClose: () => void;
  onOpenFile: (file: DeviceFile) => void;
  onSaveFile: (path: string) => Promise<void>;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DeviceFilesModal: React.FC<DeviceFilesModalProps> = ({
  isOpen,
  mode,
  defaultFileName,
  onClose,
  onOpenFile,
  onSaveFile,
}) => {
  const available = isDeviceFilesAvailable();
  const [access, setAccess] = useState<DeviceAccess | null>(null);
  const [workspace, setWorkspace] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DeviceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState(defaultFileName || "main.py");
  const [newFolder, setNewFolder] = useState("");

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDeviceDir(path);
      setCurrentPath(result.path);
      setParentPath(result.parent ?? null);
      setEntries(result.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this folder.");
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureAccess = useCallback(async () => {
    const result = await hasDeviceAccess();
    setAccess(result);
    if (!result.granted) return;

    const paths = await getDevicePaths();
    if (paths?.workspace) {
      setWorkspace(paths.workspace);
      try {
        await makeDeviceDir(paths.workspace);
      } catch {
        /* folder may already exist */
      }
      await load(paths.workspace);
    }
  }, [load]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNewFolder("");
    if (defaultFileName) setFileName(defaultFileName);
    void ensureAccess();
  }, [isOpen, defaultFileName, ensureAccess]);

  // Re-check permission when the user returns from system Settings.
  useEffect(() => {
    if (!isOpen) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void ensureAccess();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isOpen, ensureAccess]);

  const handleGrant = async () => {
    try {
      await requestDeviceAccess();
    } catch {
      setError("Couldn't open the permission screen. Grant all-files access from Android Settings.");
    }
    // The visibility listener re-checks once the user comes back.
  };

  const handleOpenFile = async (entry: DeviceEntry) => {
    setBusyPath(entry.path);
    setError(null);
    try {
      const file = await readDeviceText(entry.path);
      onOpenFile(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this file.");
    } finally {
      setBusyPath(null);
    }
  };

  const handleSave = async () => {
    const name = fileName.trim();
    if (!name) {
      setError("Enter a file name.");
      return;
    }
    const target = joinDevicePath(currentPath, name);
    setLoading(true);
    setError(null);
    try {
      await onSaveFile(target);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the file.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    setError(null);
    try {
      await makeDeviceDir(joinDevicePath(currentPath, name));
      setNewFolder("");
      await load(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the folder.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-slate-100" />
            <h2 className="text-base font-bold text-slate-100">
              {mode === "open" ? "Open from device" : "Save to device"}
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

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!available && (
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span>Device files are only available in the installed Android app.</span>
            </div>
          )}

          {available && access && !access.granted && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-amber-800/60 bg-amber-950/40 text-xs text-amber-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Cursive needs permission to read and write files in your shared storage so your
                  projects can live in a normal folder like{" "}
                  <strong className="font-mono">Documents/Cursive</strong>. On Android 11+ this
                  opens a Settings screen — turn on <strong>Allow management of all files</strong>,
                  then return here.
                </span>
              </div>
              <button
                type="button"
                onClick={handleGrant}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Grant file access</span>
              </button>
            </div>
          )}

          {available && access?.granted && (
            <>
              {error && (
                <div className="p-3 rounded-xl border border-red-800/60 bg-red-950/40 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => parentPath && load(parentPath)}
                  disabled={!parentPath}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  title="Up one folder"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 truncate">
                  {currentPath || workspace || "Documents"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden max-h-[40vh] overflow-y-auto">
                {loading && entries.length === 0 ? (
                  <div className="p-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : entries.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    This folder is empty.
                  </div>
                ) : (
                  entries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() =>
                        entry.isDirectory
                          ? load(entry.path)
                          : mode === "open"
                          ? handleOpenFile(entry)
                          : undefined
                      }
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                        !entry.isDirectory && mode === "save"
                          ? "opacity-60 cursor-default"
                          : "hover:bg-slate-800/60"
                      }`}
                    >
                      {entry.isDirectory ? (
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 truncate text-slate-200">{entry.name}</span>
                      {busyPath === entry.path && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      )}
                      {!entry.isDirectory && (
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {formatSize(entry.size)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New folder name"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!newFolder.trim()}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  title="Create folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>

              {mode === "save" && (
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <label className="text-xs text-slate-300 font-medium pt-2 block">
                    File name
                  </label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading || !fileName.trim()}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save here</span>
                  </button>
                  <p className="text-[10px] text-slate-500">
                    Writes the current file into the folder shown above.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
