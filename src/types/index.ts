export interface FileItem {
  id: string;
  projectId: string;
  name: string;
  path: string;
  language: string;
  content: string;
  notes?: string;
  isFolder: boolean;
  parentId?: string | null;
  isOpen?: boolean;
  isDirty?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId?: string | null;
  name: string;
  description?: string;
  githubRepo?: string | null;
  githubBranch?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BuiltinThemeId =
  | "vs-dark"
  | "vs-light"
  | "hc-black"
  | "github-dark"
  | "github-light"
  | "dracula"
  | "monokai"
  | "nord"
  | "one-dark-pro"
  | "custom";

export interface CustomThemeColors {
  background: string;
  foreground: string;
  accent: string;
  sidebarBg: string;
  editorBg: string;
  lineHighlight: string;
  selectionBg: string;
  cursorColor: string;
}

export interface EditorSettings {
  theme: BuiltinThemeId;
  customTheme: CustomThemeColors;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
  lineNumbers: "on" | "off" | "relative";
  minimap: boolean;
  cursorSmoothCaretAnimation: "on" | "off";
  cursorBlinking: "smooth" | "blink" | "solid" | "expand";
  autoIndent: "full" | "advanced" | "brackets" | "none";
  formatOnPaste: boolean;
  formatOnType: boolean;
  quickSuggestions: boolean;
  parameterHints: boolean;
  showInvisibles: boolean;
  autoSaveDelay: number; // in milliseconds, e.g. 1500
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number | null;
  executionTime?: number;
  language: string;
  version?: string;
  error?: string;
  engine?: string;
  status: "idle" | "running" | "success" | "error";
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}
