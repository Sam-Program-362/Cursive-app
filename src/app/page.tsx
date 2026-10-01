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
import { executeInBrowser, isPythonRuntimeReady } from "@/lib/runtime";
import { STARTER_TEMPLATES, ProjectTemplate } from "@/lib/templates";
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

export default function CodePadApp() {
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

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<string | null>(null);
  const [runLanguage, setRunLanguage] = useState<string>("python");
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState("");

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);

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
  const activeFile = files.find((f) => f.id === activeFileId) || null;

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
      content: isFolder ? "" : lang.sampleCode || "",
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

  // Run code entirely in the browser (Pyodide for Python, sandboxed iframe for JS)
  const handleRunCode = async () => {
    if (!activeFile) return;

    openConsole();
    setIsRunning(true);
    setExecutionResult(null);
    setRuntimeStatus(null);

    const languageId =
      runLanguage || getLanguageByFilename(activeFile.name).id || activeFile.language;

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
          <span className="text-sm font-medium">Initializing CodePad...</span>
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
          />
        </div>

        {/* Center: Editor and Tabs */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
          {/* Tabs Bar */}
          <TabBar
            files={files}
            openFileIds={openFileIds}
            activeFileId={activeFileId}
            onSelectTab={handleSelectFile}
            onCloseTab={handleCloseTab}
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
              openFiles={files.filter(
                (candidate) =>
                  openFileIds.includes(candidate.id) && !candidate.isFolder
              )}
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
        onClose={() => setIsAIModalOpen(false)}
        onInsertCode={(code) => handleInsertText("\n" + code)}
        onReplaceCode={(code) => handleContentChange(code)}
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
      />
    </div>
  );
}
