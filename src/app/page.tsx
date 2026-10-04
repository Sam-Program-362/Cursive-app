"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  FileItem,
  Project,
  EditorSettings,
  ExecutionResult,
  BuiltinThemeId,
} from "@/types";
import {
  loadSettings,
  saveSettings,
  loadConsolePrefs,
  saveConsolePrefs,
  initializeWorkspace,
  saveProjectsLocal,
  saveFilesLocal,
  syncFileToNeon,
  syncProjectToNeon,
  exportProjectAsZip,
} from "@/lib/storage";
import { getLanguageByFilename } from "@/lib/languages";
import {
  executeInBrowser,
  isPythonRuntimeReady,
  isNativePlatform,
  startNativePythonRun,
  sendNativeInput,
  stopNativePython,
} from "@/lib/runtime";
import { STARTER_TEMPLATES, ProjectTemplate } from "@/lib/templates";
import {
  NEW_FILE_TEMPLATES,
  NewFileTemplate,
  EXAMPLE_PROGRAMS,
  ExampleProgram,
} from "@/lib/examples";
import { THEMES } from "@/lib/themes";

import { TopNavbar } from "@/components/Editor/TopNavbar";
import { FileTree } from "@/components/Editor/FileTree";
import { TabBar } from "@/components/Editor/TabBar";
import { QuickKeyBar } from "@/components/Editor/QuickKeyBar";
import { NotepadPanel } from "@/components/Editor/NotepadPanel";
import { ConsolePanel } from "@/components/Editor/ConsolePanel";

import { ThemeModal } from "@/components/Modals/ThemeModal";
import { SettingsModal } from "@/components/Modals/SettingsModal";
import { AIModal } from "@/components/Modals/AIModal";
import { GitHubModal } from "@/components/Modals/GitHubModal";
import { TemplatesModal } from "@/components/Modals/TemplatesModal";
import { DeviceFilesModal } from "@/components/Modals/DeviceFilesModal";
import {
  getLaunchFile,
  writeDeviceText,
  isDeviceFilesAvailable,
  type DeviceFile,
} from "@/lib/device-files";
import { Loader2 } from "lucide-react";

// Dynamically load CodeEditor on client
const CodeEditor = dynamic(
  () => import("@/components/Editor/CodeEditor").then((mod) => mod.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full w-full bg-slate-950 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-xs">Loading Editor...</span>
      </div>
    ),
  }
);

export default function CursiveApp() {
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [activeFileId, setActiveFileId] = useState<string>("");
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<EditorSettings>(loadSettings());

  // Panels visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  // Modals visibility
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  // Device file browser (Android): null = closed, otherwise the mode.
  const [deviceModalMode, setDeviceModalMode] = useState<"open" | "save" | null>(null);

  // Read-only sample programs opened from the Examples list. They live here
  // (not in `files`) so they are never saved, synced or listed as your files.
  const [exampleTabs, setExampleTabs] = useState<FileItem[]>([]);
  // Tab waiting on Save / Don't save / Cancel when being closed.
  const [pendingCloseFile, setPendingCloseFile] = useState<FileItem | null>(null);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<string | null>(null);
  const [runLanguage, setRunLanguage] = useState<string>("python");
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState("");
  // Prompt shown while on-device Python is waiting on input().
  const [nativeInputPrompt, setNativeInputPrompt] = useState<string | null>(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);
  const launchFileHandledRef = useRef(false);

  // Responsive: auto-close sidebar on smaller screens on initial mount
  useEffect(() => {
    setMounted(true);
    const workspace = initializeWorkspace();
    setProjects(workspace.projects);
    setFiles(workspace.files);
    setActiveProjectId(workspace.activeProjectId);
    setActiveFileId(workspace.activeFileId);

    const initialOpen = workspace.files
      .filter((f) => f.projectId === workspace.activeProjectId && !f.isFolder)
      .map((f) => f.id);
    setOpenFileIds(initialOpen.length > 0 ? initialOpen : [workspace.activeFileId]);

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    // Restore the run-output panel's last open/closed state
    setIsConsoleOpen(loadConsolePrefs().isOpen);

    // Register service worker for PWA offline support
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    }
  }, []);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  const activeFile =
    files.find((f) => f.id === activeFileId) ||
    exampleTabs.find((f) => f.id === activeFileId) ||
    null;

  // Auto-save handler
  const scheduleSave = useCallback(
    (updatedFiles: FileItem[]) => {
      setSaveStatus("unsaved");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        saveFilesLocal(updatedFiles);

        // Background Neon DB sync if file is updated
        const currentFile = updatedFiles.find((f) => f.id === activeFileId);
        if (currentFile) {
          await syncFileToNeon(currentFile);
        }

        setSaveStatus("saved");
      }, settings.autoSaveDelay || 1500);
    },
    [activeFileId, settings.autoSaveDelay]
  );

  // Handle file content modification
  const handleContentChange = (newContent: string) => {
    if (!activeFileId) return;

    setFiles((prev) => {
      const updated = prev.map((file) => {
        if (file.id === activeFileId) {
          return {
            ...file,
            content: newContent,
            isDirty: true,
            updatedAt: new Date().toISOString(),
          };
        }
        return file;
      });
      scheduleSave(updated);
      return updated;
    });
  };

  // Handle notes change for per-file notepad
  const handleNotesChange = (fileId: string, notes: string) => {
    setFiles((prev) => {
      const updated = prev.map((file) => {
        if (file.id === fileId) {
          return {
            ...file,
            notes,
            updatedAt: new Date().toISOString(),
          };
        }
        return file;
      });
      scheduleSave(updated);
      return updated;
    });
  };

  // Settings update
  const handleUpdateSettings = (newSettings: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  };

  // Run-output (console) panel visibility — persisted across sessions
  const openConsole = () => {
    setIsConsoleOpen(true);
    saveConsolePrefs({ isOpen: true });
  };

  const handleCloseConsole = () => {
    setIsConsoleOpen(false);
    saveConsolePrefs({ isOpen: false });
  };

  const handleToggleConsole = () => {
    const next = !isConsoleOpen;
    setIsConsoleOpen(next);
    saveConsolePrefs({ isOpen: next });
  };

  // Switch active file & open tab
  const handleSelectFile = (fileId: string) => {
    setActiveFileId(fileId);
    if (!openFileIds.includes(fileId)) {
      setOpenFileIds((prev) => [...prev, fileId]);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("codepad_active_file_id", fileId);
    }
    // On mobile, collapse sidebar on file select
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Close open tab
  const handleCloseTab = (fileIdToClose: string) => {
    setExampleTabs((prev) => prev.filter((f) => f.id !== fileIdToClose));
    const updated = openFileIds.filter((id) => id !== fileIdToClose);
    setOpenFileIds(updated);

    if (activeFileId === fileIdToClose) {
      const nextActive = updated[updated.length - 1] || "";
      setActiveFileId(nextActive);
      if (typeof window !== "undefined") {
        localStorage.setItem("codepad_active_file_id", nextActive);
      }
    }
  };

  // Create new file or folder
  const handleCreateFile = (
    name: string,
    isFolder: boolean,
    parentId?: string | null
  ) => {
    if (!activeProjectId) return;

    const lang = getLanguageByFilename(name);
    const newId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newFile: FileItem = {
      id: newId,
      projectId: activeProjectId,
      name,
      path: `/${name}`,
      language: lang.id,
      // New files start BLANK (no sample code inserted).
      content: "",
      notes: "",
      isFolder,
      parentId: parentId || null,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...files, newFile];
    setFiles(updated);
    saveFilesLocal(updated);
    syncFileToNeon(newFile);

    if (!isFolder) {
      handleSelectFile(newId);
    }
  };

  // Create a file from an optional starter snippet ("New from template").
  // Normal new files are always blank; this only runs when the user picks one.
  const handleCreateFromTemplate = (template: NewFileTemplate) => {
    if (!activeProjectId) return;
    const newId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newFile: FileItem = {
      id: newId,
      projectId: activeProjectId,
      name: template.fileName,
      path: `/${template.fileName}`,
      language: template.language,
      content: template.content,
      notes: "",
      isFolder: false,
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...files, newFile];
    setFiles(updated);
    saveFilesLocal(updated);
    syncFileToNeon(newFile);
    handleSelectFile(newId);
    setIsTemplatesModalOpen(false);
  };

  // Open a read-only sample program in its own tab.
  const handleSelectExample = (example: ExampleProgram) => {
    const id = `example__${example.id}`;
    setExampleTabs((prev) => {
      if (prev.some((f) => f.id === id)) return prev;
      const now = new Date().toISOString();
      return [
        ...prev,
        {
          id,
          projectId: "examples",
          name: example.name,
          path: `/${example.name}`,
          language: example.language,
          content: example.content,
          notes: "",
          isFolder: false,
          parentId: null,
          readOnly: true,
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
    setOpenFileIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveFileId(id);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // A dirty tab was confirmed for closing — ask before losing the changes.
  const handleRequestCloseDirty = (file: FileItem) => {
    setPendingCloseFile(file);
  };

  const handleSaveAndClose = () => {
    if (!pendingCloseFile) return;
    setFiles((prev) => {
      const updated = prev.map((f) =>
        f.id === pendingCloseFile.id
          ? { ...f, isDirty: false, updatedAt: new Date().toISOString() }
          : f
      );
      saveFilesLocal(updated);
      return updated;
    });
    const closing = pendingCloseFile;
    setPendingCloseFile(null);
    handleCloseTab(closing.id);
  };

  const handleDiscardAndClose = () => {
    if (!pendingCloseFile) return;
    const closing = pendingCloseFile;
    setPendingCloseFile(null);
    handleCloseTab(closing.id);
  };

  // Rename file or folder
  const handleRenameFile = (fileId: string, newName: string) => {
    const lang = getLanguageByFilename(newName);
    setFiles((prev) => {
      const updated = prev.map((f) => {
        if (f.id === fileId) {
          const mod = {
            ...f,
            name: newName,
            language: f.isFolder ? "plaintext" : lang.id,
            updatedAt: new Date().toISOString(),
          };
          syncFileToNeon(mod);
          return mod;
        }
        return f;
      });
      saveFilesLocal(updated);
      return updated;
    });
  };

  // Delete file or folder
  const handleDeleteFile = (fileId: string) => {
    setFiles((prev) => {
      const updated = prev.filter(
        (f) => f.id !== fileId && f.parentId !== fileId
      );
      saveFilesLocal(updated);
      fetch(`/api/files?id=${fileId}`, { method: "DELETE" }).catch(() => {});
      return updated;
    });

    handleCloseTab(fileId);
  };

  // Keep the run-language selector in sync with the active file's type
  useEffect(() => {
    if (!activeFile) return;
    const detected = getLanguageByFilename(activeFile.name).id;
    setRunLanguage(detected === "plaintext" ? "javascript" : detected);
  }, [activeFileId, activeFile?.name]);

  // Native Python (Android app): stream output live, support input() and Stop.
  const runPythonNatively = async (file: FileItem) => {
    const pathOf = (item: FileItem) => item.path || item.name;
    const projectFiles = files
      .filter((item) => !item.isFolder)
      .map((item) => ({ path: pathOf(item), content: item.content || "" }));
    if (!projectFiles.some((item) => item.path === pathOf(file))) {
      projectFiles.push({ path: pathOf(file), content: file.content || "" });
    }

    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let completed = false;
    let pendingFlush = false;
    const started = Date.now();

    const flush = () => {
      setExecutionResult({
        stdout,
        stderr,
        output:
          [stdout, stderr].filter(Boolean).join("\n") ||
          "Program executed with no output.",
        exitCode,
        executionTime: Date.now() - started,
        language: "python",
        version: "3.12",
        status: exitCode === 0 ? "success" : "error",
        engine: "chaquopy-cpython",
      });
    };

    // Batch re-renders so chatty programs stay smooth.
    const scheduleFlush = () => {
      if (completed || pendingFlush) return;
      pendingFlush = true;
      setTimeout(() => {
        pendingFlush = false;
        if (!completed) flush();
      }, 60);
    };

    try {
      await startNativePythonRun(projectFiles, pathOf(file), {
        onStdout: (text) => {
          stdout += text;
          scheduleFlush();
        },
        onStderr: (text) => {
          stderr += text;
          scheduleFlush();
        },
        onInputRequest: (prompt) => {
          setNativeInputPrompt(prompt || " ");
          setRuntimeStatus(
            prompt ? `Waiting for input: ${prompt}` : "Waiting for input..."
          );
          flush();
        },
        onExit: (code) => {
          exitCode = code;
          completed = true;
          flush();
          setNativeInputPrompt(null);
          setRuntimeStatus(null);
          setIsRunning(false);
        },
      });
      setRuntimeStatus("Running Python on device (CPython)...");
    } catch (err: any) {
      const message =
        "Failed to start the on-device Python runtime: " + (err?.message || err);
      setExecutionResult({
        stdout: "",
        stderr: message,
        output: message,
        exitCode: 1,
        language: "python",
        status: "error",
      });
      setRuntimeStatus(null);
      setIsRunning(false);
    }
  };

  const handleNativeInputSubmit = (text: string) => {
    setNativeInputPrompt(null);
    setRuntimeStatus("Running Python on device (CPython)...");
    void sendNativeInput(text);
  };

  const handleStopCode = () => {
    void stopNativePython();
    setRuntimeStatus("Stopping...");
    setNativeInputPrompt(null);
  };

  // Run code entirely on-device: real CPython (Chaquopy) in the Android app,
  // Pyodide for Python / sandboxed iframe for JS in the browser.
  const handleRunCode = async () => {
    if (!activeFile) return;

    openConsole();
    setIsRunning(true);
    setExecutionResult(null);
    setRuntimeStatus(null);
    setNativeInputPrompt(null);

    const languageId =
      runLanguage || getLanguageByFilename(activeFile.name).id || activeFile.language;

    if (languageId === "python" && isNativePlatform()) {
      await runPythonNatively(activeFile);
      return;
    }

    try {
      const data = await executeInBrowser(
        languageId,
        activeFile.content,
        stdin,
        {
          onRuntimeLoading: () => {
            if (!isPythonRuntimeReady()) {
              setRuntimeStatus("Loading Python runtime (first run only)...");
            }
          },
        }
      );
      setExecutionResult(data);
    } catch (err: any) {
      setExecutionResult({
        stdout: "",
        stderr: "Execution error: " + err.message,
        output: "Execution error: " + err.message,
        exitCode: 1,
        language: activeFile.language,
        status: "error",
      });
    } finally {
      setRuntimeStatus(null);
      setIsRunning(false);
    }
  };

  // Mobile quick key actions
  const handleInsertText = (text: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      editor.executeEdits("quick-key", [
        {
          range: selection,
          text: text,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
    }
  };

  const handleIndent = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "editor.action.indentLines", null);
      editorRef.current.focus();
    }
  };

  const handleOutdent = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "editor.action.outdentLines", null);
      editorRef.current.focus();
    }
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "undo", null);
      editorRef.current.focus();
    }
  };

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "redo", null);
      editorRef.current.focus();
    }
  };

  // Load project template
  const handleSelectTemplate = (template: ProjectTemplate) => {
    const projId = `proj_${template.id}_${Date.now()}`;
    const now = new Date().toISOString();

    const newProj: Project = {
      id: projId,
      name: template.name,
      description: template.description,
      createdAt: now,
      updatedAt: now,
    };

    const newTemplateFiles: FileItem[] = template.files.map((tf, idx) => ({
      id: `file_${projId}_${idx}`,
      projectId: projId,
      name: tf.name,
      path: tf.path,
      language: tf.language,
      content: tf.content,
      notes: tf.notes || "",
      isFolder: tf.isFolder,
      isOpen: idx === 0,
      createdAt: now,
      updatedAt: now,
    }));

    const updatedProjects = [newProj, ...projects];
    const updatedFiles = [...files, ...newTemplateFiles];

    setProjects(updatedProjects);
    setFiles(updatedFiles);
    setActiveProjectId(projId);
    setActiveFileId(newTemplateFiles[0].id);
    setOpenFileIds(newTemplateFiles.map((f) => f.id));

    saveProjectsLocal(updatedProjects);
    saveFilesLocal(updatedFiles);
    syncProjectToNeon(newProj);
    newTemplateFiles.forEach((f) => syncFileToNeon(f));

    if (typeof window !== "undefined") {
      localStorage.setItem("codepad_active_project_id", projId);
      localStorage.setItem("codepad_active_file_id", newTemplateFiles[0].id);
    }
  };

  // Import files from GitHub pull
  const handleImportGitHubFiles = (
    imported: { name: string; path: string; content: string }[],
    repoName: string
  ) => {
    if (!activeProjectId) return;
    const now = new Date().toISOString();

    const newFiles: FileItem[] = imported.map((imp, idx) => {
      const lang = getLanguageByFilename(imp.name);
      return {
        id: `file_gh_${Date.now()}_${idx}`,
        projectId: activeProjectId,
        name: imp.name,
        path: imp.path,
        language: lang.id,
        content: imp.content,
        notes: `Imported from GitHub repo: ${repoName}`,
        isFolder: false,
        createdAt: now,
        updatedAt: now,
      };
    });

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    saveFilesLocal(updatedFiles);

    if (newFiles.length > 0) {
      handleSelectFile(newFiles[0].id);
      setOpenFileIds((prev) => [
        ...prev,
        ...newFiles.slice(0, 5).map((f) => f.id),
      ]);
    }
  };

  // Open a real device file in the editor (adds it to the current project).
  const handleOpenDeviceFile = (deviceFile: DeviceFile) => {
    if (!activeProjectId) return;
    const now = new Date().toISOString();
    const lang = getLanguageByFilename(deviceFile.name);
    const newFile: FileItem = {
      id: `file_dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: activeProjectId,
      name: deviceFile.name,
      path: `/${deviceFile.name}`,
      language: lang.id,
      content: deviceFile.content,
      notes: `Opened from ${deviceFile.path}`,
      isFolder: false,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...files, newFile];
    setFiles(updated);
    saveFilesLocal(updated);
    syncFileToNeon(newFile);
    handleSelectFile(newFile.id);
  };

  // Save the open file to a real path on the device.
  const handleSaveToDeviceTarget = async (path: string) => {
    if (!activeFile) throw new Error("No file is open.");
    await writeDeviceText(path, activeFile.content ?? "");
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, isDirty: false } : f))
    );
    setSaveStatus("saved");
  };

  // If the app was opened with a .py file (shared from another app), load it.
  useEffect(() => {
    if (launchFileHandledRef.current || !activeProjectId) return;
    if (!isDeviceFilesAvailable()) return;
    launchFileHandledRef.current = true;
    (async () => {
      const file = await getLaunchFile();
      if (file) handleOpenDeviceFile(file);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Export workspace as ZIP file
  const handleExportZip = async () => {
    if (!activeProject) return;
    const zipBlob = await exportProjectAsZip(activeProject, files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.name.toLowerCase().replace(/\s+/g, "-")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Dynamic active theme styling
  const activeThemeDef =
    THEMES[settings.theme as BuiltinThemeId] || THEMES["vs-dark"];
  const customColors = settings.customTheme;
  const isCustom = settings.theme === "custom";

  const appBackground = isCustom ? customColors.background : activeThemeDef.uiBg;
  const appSidebar = isCustom ? customColors.sidebarBg : activeThemeDef.uiSidebar;
  const appAccent = isCustom ? customColors.accent : activeThemeDef.accent;
  const appText = isCustom ? customColors.foreground : activeThemeDef.uiText;

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Initializing Cursive...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen w-full overflow-hidden transition-colors duration-150"
      style={{
        backgroundColor: appBackground,
        color: appText,
      }}
    >
      {/* Top Navbar */}
      <TopNavbar
        project={activeProject}
        activeFile={activeFile}
        isRunning={isRunning}
        saveStatus={saveStatus}
        isSidebarOpen={isSidebarOpen}
        isNotepadOpen={isNotepadOpen}
        isConsoleOpen={isConsoleOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleNotepad={() => setIsNotepadOpen(!isNotepadOpen)}
        onToggleConsole={handleToggleConsole}
        onRun={handleRunCode}
        onOpenAI={() => setIsAIModalOpen(true)}
        onOpenTheme={() => setIsThemeModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenGitHub={() => setIsGitHubModalOpen(true)}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        onExportZip={handleExportZip}
        showDeviceButtons={isDeviceFilesAvailable()}
        onOpenDeviceFile={() => setDeviceModalMode("open")}
        onSaveToDevice={() => setDeviceModalMode("save")}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar File Tree */}
        <div
          className={`h-full transition-all duration-200 shrink-0 ${
            isSidebarOpen
              ? "w-64 md:w-60 block absolute md:relative z-20 shadow-2xl md:shadow-none"
              : "w-0 hidden md:block md:w-0 overflow-hidden border-none"
          }`}
          style={{ backgroundColor: appSidebar }}
        >
          <FileTree
            project={activeProject}
            files={files}
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            onOpenTemplates={() => setIsTemplatesModalOpen(true)}
            examples={EXAMPLE_PROGRAMS}
            onSelectExample={handleSelectExample}
          />
        </div>

        {/* Center: Editor and Tabs */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
          {/* Tabs Bar */}
          <TabBar
            files={[...files, ...exampleTabs]}
            openFileIds={openFileIds}
            activeFileId={activeFileId}
            onSelectTab={handleSelectFile}
            onCloseTab={handleCloseTab}
            onRequestCloseDirty={handleRequestCloseDirty}
            onNewFile={() => handleCreateFile("untitled.py", false)}
            accentColor={appAccent}
          />

          {/* Quick Key Row for Mobile / Fast Coding */}
          <QuickKeyBar
            onInsertText={handleInsertText}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onOpenAI={() => setIsAIModalOpen(true)}
          />

          {/* Monaco Editor Container */}
          <div className="flex-1 min-h-0 relative">
            <CodeEditor
              file={activeFile}
              settings={settings}
              onChange={handleContentChange}
              onRun={handleRunCode}
              onOpenAI={() => setIsAIModalOpen(true)}
              editorRefOut={editorRef}
              files={files}
            />
          </div>
        </div>

        {/* Right Run-Output Panel — split pane on desktop, slide-in
            overlay drawer on mobile. Mirrors the file-tree sidebar. */}
        <ConsolePanel
          isOpen={isConsoleOpen}
          result={executionResult}
          isRunning={isRunning}
          runtimeStatus={runtimeStatus}
          runLanguage={runLanguage}
          setRunLanguage={setRunLanguage}
          activeFile={activeFile}
          allFiles={files}
          stdin={stdin}
          setStdin={setStdin}
          onRun={handleRunCode}
          onClose={handleCloseConsole}
          onClear={() => setExecutionResult(null)}
          isNative={isNativePlatform()}
          nativeInputPrompt={nativeInputPrompt}
          onNativeInputSubmit={handleNativeInputSubmit}
          onStop={handleStopCode}
        />

        {/* Right Collapsible Notepad Panel */}
        <NotepadPanel
          file={activeFile}
          isOpen={isNotepadOpen}
          onClose={() => setIsNotepadOpen(false)}
          onSaveNotes={handleNotesChange}
        />
      </div>

      {/* Modals */}
      <ThemeModal
        isOpen={isThemeModalOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsThemeModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <AIModal
        isOpen={isAIModalOpen}
        activeFile={activeFile}
        files={files}
        lastRunResult={executionResult}
        getSelection={() => {
          const editor = editorRef.current;
          if (!editor || typeof editor.getSelection !== "function") return "";
          const model = editor.getModel?.();
          const sel = editor.getSelection();
          if (!model || !sel) return "";
          return model.getValueInRange(sel) || "";
        }}
        onClose={() => setIsAIModalOpen(false)}
        onInsertCode={(code) => handleInsertText("\n" + code)}
        onReplaceCode={(code) => handleContentChange(code)}
        onOpenSettings={() => {
          setIsAIModalOpen(false);
          setIsSettingsModalOpen(true);
        }}
      />

      <GitHubModal
        isOpen={isGitHubModalOpen}
        project={activeProject}
        files={files}
        onClose={() => setIsGitHubModalOpen(false)}
        onImportFiles={handleImportGitHubFiles}
      />

      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        onSelectSnippet={handleCreateFromTemplate}
        snippets={NEW_FILE_TEMPLATES}
      />

      <DeviceFilesModal
        isOpen={deviceModalMode !== null}
        mode={deviceModalMode === "save" ? "save" : "open"}
        defaultFileName={activeFile?.name}
        onClose={() => setDeviceModalMode(null)}
        onOpenFile={handleOpenDeviceFile}
        onSaveFile={handleSaveToDeviceTarget}
      />

      {/* Unsaved-changes sheet shown when closing a dirty tab */}
      {pendingCloseFile && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fadeIn"
          onClick={() => setPendingCloseFile(null)}
        >
          <div
            className="w-full max-w-md m-3 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-sm font-semibold text-slate-100 truncate">
                Save changes to “{pendingCloseFile.name}”?
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                This file has unsaved changes.
              </p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleDiscardAndClose}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
              >
                Don&apos;t save
              </button>
              <button
                type="button"
                onClick={() => setPendingCloseFile(null)}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
