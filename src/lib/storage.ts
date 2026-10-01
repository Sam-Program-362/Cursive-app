import { FileItem, Project, EditorSettings } from "@/types";
import { STARTER_TEMPLATES } from "./templates";
import JSZip from "jszip";

const STORAGE_KEY_PROJECTS = "codepad_projects";
const STORAGE_KEY_FILES = "codepad_files";
const STORAGE_KEY_SETTINGS = "codepad_settings";
const STORAGE_KEY_ACTIVE_PROJECT = "codepad_active_project_id";
const STORAGE_KEY_ACTIVE_FILE = "codepad_active_file_id";
const STORAGE_KEY_CONSOLE_PANEL = "codepad_console_panel";

export const DEFAULT_SETTINGS: EditorSettings = {
  theme: "vs-dark",
  customTheme: {
    background: "#0f172a",
    foreground: "#f8fafc",
    accent: "#38bdf8",
    sidebarBg: "#1e293b",
    editorBg: "#0b0f19",
    lineHighlight: "#1e293b55",
    selectionBg: "#38bdf833",
    cursorColor: "#38bdf8",
  },
  fontSize: 14,
  fontFamily: "Fira Code, monospace",
  tabSize: 2,
  wordWrap: "on",
  lineNumbers: "on",
  minimap: false,
  cursorSmoothCaretAnimation: "on",
  cursorBlinking: "smooth",
  autoIndent: "full",
  formatOnPaste: true,
  formatOnType: true,
  quickSuggestions: true,
  parameterHints: true,
  showInvisibles: false,
  autoSaveDelay: 1500,
};

export function loadSettings(): EditorSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: EditorSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Run-output (console) panel preferences — persisted open/width state */
/* ------------------------------------------------------------------ */

export interface ConsolePanelPrefs {
  /** Whether the run-output panel was open in the user's last session. */
  isOpen: boolean;
  /** Last user-chosen width (px) of the panel on wide screens. */
  width: number;
}

export const CONSOLE_PANEL_MIN_WIDTH = 280;
export const CONSOLE_PANEL_DEFAULT_WIDTH = 440;

export const DEFAULT_CONSOLE_PREFS: ConsolePanelPrefs = {
  isOpen: false,
  width: CONSOLE_PANEL_DEFAULT_WIDTH,
};

export function loadConsolePrefs(): ConsolePanelPrefs {
  if (typeof window === "undefined") return DEFAULT_CONSOLE_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONSOLE_PANEL);
    if (!raw) return DEFAULT_CONSOLE_PREFS;
    const parsed = JSON.parse(raw);
    return {
      isOpen: typeof parsed?.isOpen === "boolean" ? parsed.isOpen : false,
      width:
        typeof parsed?.width === "number" &&
        parsed.width >= CONSOLE_PANEL_MIN_WIDTH &&
        parsed.width <= 1600
          ? Math.round(parsed.width)
          : CONSOLE_PANEL_DEFAULT_WIDTH,
    };
  } catch {
    return DEFAULT_CONSOLE_PREFS;
  }
}

export function saveConsolePrefs(prefs: Partial<ConsolePanelPrefs>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadConsolePrefs();
    localStorage.setItem(
      STORAGE_KEY_CONSOLE_PANEL,
      JSON.stringify({ ...current, ...prefs })
    );
  } catch {}
}

export function initializeWorkspace(): {
  projects: Project[];
  files: FileItem[];
  activeProjectId: string;
  activeFileId: string;
} {
  if (typeof window === "undefined") {
    return {
      projects: [],
      files: [],
      activeProjectId: "",
      activeFileId: "",
    };
  }

  let projects: Project[] = [];
  let files: FileItem[] = [];
  let activeProjectId = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT) || "";
  let activeFileId = localStorage.getItem(STORAGE_KEY_ACTIVE_FILE) || "";

  try {
    const rawProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (rawProjects) projects = JSON.parse(rawProjects);

    const rawFiles = localStorage.getItem(STORAGE_KEY_FILES);
    if (rawFiles) files = JSON.parse(rawFiles);
  } catch {}

  // If empty, load default template (Python Starter)
  if (projects.length === 0 || files.length === 0) {
    const template = STARTER_TEMPLATES[0]; // Python Starter
    const defaultProjectId = "proj_default_python";
    const now = new Date().toISOString();

    const initialProject: Project = {
      id: defaultProjectId,
      name: template.name,
      description: template.description,
      createdAt: now,
      updatedAt: now,
    };

    const initialFiles: FileItem[] = template.files.map((tf, index) => ({
      id: `file_${defaultProjectId}_${index}`,
      projectId: defaultProjectId,
      name: tf.name,
      path: tf.path,
      language: tf.language,
      content: tf.content,
      notes: tf.notes || "",
      isFolder: tf.isFolder,
      isOpen: index === 0,
      createdAt: now,
      updatedAt: now,
    }));

    projects = [initialProject];
    files = initialFiles;
    activeProjectId = defaultProjectId;
    activeFileId = initialFiles[0].id;

    saveProjectsLocal(projects);
    saveFilesLocal(files);
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, activeProjectId);
    localStorage.setItem(STORAGE_KEY_ACTIVE_FILE, activeFileId);
  }

  // Ensure activeProjectId and activeFileId are valid
  if (!projects.find((p) => p.id === activeProjectId)) {
    activeProjectId = projects[0]?.id || "";
  }

  const projectFiles = files.filter((f) => f.projectId === activeProjectId);
  if (!projectFiles.find((f) => f.id === activeFileId)) {
    activeFileId = projectFiles[0]?.id || "";
  }

  return { projects, files, activeProjectId, activeFileId };
}

export function saveProjectsLocal(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch {}
}

export function saveFilesLocal(files: FileItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(files));
  } catch {}
}

export async function syncFileToNeon(file: FileItem): Promise<boolean> {
  try {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(file),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncProjectToNeon(project: Project): Promise<boolean> {
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function exportProjectAsZip(
  project: Project,
  files: FileItem[]
): Promise<Blob> {
  const zip = new JSZip();
  const projectFiles = files.filter(
    (f) => f.projectId === project.id && !f.isFolder
  );

  for (const f of projectFiles) {
    const cleanPath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
    zip.file(cleanPath, f.content);
    if (f.notes && f.notes.trim().length > 0) {
      zip.file(`.codepad-notes/${cleanPath}.notes.md`, f.notes);
    }
  }

  return await zip.generateAsync({ type: "blob" });
}
