import type { CustomThemeColors, BuiltinThemeId } from "@/types";

export interface ThemeDefinition {
  id: BuiltinThemeId;
  name: string;
  isDark: boolean;
  monacoBase: "vs" | "vs-dark" | "hc-black";
  uiBg: string;
  uiSidebar: string;
  uiBorder: string;
  uiText: string;
  uiMuted: string;
  accent: string;
  monacoThemeData?: any;
}

export const THEMES: Record<BuiltinThemeId, ThemeDefinition> = {
  "vs-dark": {
    id: "vs-dark",
    name: "Visual Studio Dark",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#1e1e1e",
    uiSidebar: "#252526",
    uiBorder: "#333333",
    uiText: "#d4d4d4",
    uiMuted: "#858585",
    accent: "#007acc",
  },
  "vs-light": {
    id: "vs-light",
    name: "Visual Studio Light",
    isDark: false,
    monacoBase: "vs",
    uiBg: "#ffffff",
    uiSidebar: "#f3f3f3",
    uiBorder: "#e5e5e5",
    uiText: "#1e1e1e",
    uiMuted: "#71717a",
    accent: "#007acc",
  },
  "hc-black": {
    id: "hc-black",
    name: "High Contrast Dark",
    isDark: true,
    monacoBase: "hc-black",
    uiBg: "#000000",
    uiSidebar: "#0a0a0a",
    uiBorder: "#6fc3df",
    uiText: "#ffffff",
    uiMuted: "#a0a0a0",
    accent: "#f38518",
  },
  "one-dark-pro": {
    id: "one-dark-pro",
    name: "One Dark Pro",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#282c34",
    uiSidebar: "#21252b",
    uiBorder: "#1b1d23",
    uiText: "#abb2bf",
    uiMuted: "#5c6370",
    accent: "#61afef",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5c6370", fontStyle: "italic" },
        { token: "keyword", foreground: "c678dd" },
        { token: "identifier", foreground: "e06c75" },
        { token: "string", foreground: "98c379" },
        { token: "number", foreground: "d19a66" },
        { token: "type", foreground: "e5c07b" },
        { token: "function", foreground: "61afef" },
      ],
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
        "editorCursor.foreground": "#528bff",
        "editor.lineHighlightBackground": "#2c313a",
        "editor.selectionBackground": "#3e4451",
      },
    },
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#282a36",
    uiSidebar: "#21222c",
    uiBorder: "#44475a",
    uiText: "#f8f8f2",
    uiMuted: "#6272a4",
    accent: "#bd93f9",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "ff79c6" },
        { token: "string", foreground: "f1fa8c" },
        { token: "number", foreground: "bd93f9" },
        { token: "function", foreground: "50fa7b" },
        { token: "type", foreground: "8be9fd" },
      ],
      colors: {
        "editor.background": "#282a36",
        "editor.foreground": "#f8f8f2",
        "editorCursor.foreground": "#ae81ff",
        "editor.lineHighlightBackground": "#44475a50",
        "editor.selectionBackground": "#44475a",
      },
    },
  },
  monokai: {
    id: "monokai",
    name: "Monokai",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#272822",
    uiSidebar: "#1e1f1c",
    uiBorder: "#3e3d32",
    uiText: "#f8f8f2",
    uiMuted: "#75715e",
    accent: "#a6e22e",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "75715e" },
        { token: "keyword", foreground: "f92672" },
        { token: "string", foreground: "e6db74" },
        { token: "number", foreground: "ae81ff" },
        { token: "function", foreground: "a6e22e" },
        { token: "type", foreground: "66d9ef" },
      ],
      colors: {
        "editor.background": "#272822",
        "editor.foreground": "#f8f8f2",
        "editorCursor.foreground": "#f8f8f0",
        "editor.lineHighlightBackground": "#3e3d32",
        "editor.selectionBackground": "#49483e",
      },
    },
  },
  nord: {
    id: "nord",
    name: "Nord",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#2e3440",
    uiSidebar: "#242933",
    uiBorder: "#3b4252",
    uiText: "#d8dee9",
    uiMuted: "#4c566a",
    accent: "#88c0d0",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "4c566a", fontStyle: "italic" },
        { token: "keyword", foreground: "81a1c1" },
        { token: "string", foreground: "a3be8c" },
        { token: "number", foreground: "b48ead" },
        { token: "function", foreground: "88c0d0" },
        { token: "type", foreground: "8fbcbb" },
      ],
      colors: {
        "editor.background": "#2e3440",
        "editor.foreground": "#d8dee9",
        "editorCursor.foreground": "#d8dee9",
        "editor.lineHighlightBackground": "#3b425250",
        "editor.selectionBackground": "#434c5e",
      },
    },
  },
  "github-dark": {
    id: "github-dark",
    name: "GitHub Dark",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#0d1117",
    uiSidebar: "#161b22",
    uiBorder: "#30363d",
    uiText: "#c9d1d9",
    uiMuted: "#8b949e",
    accent: "#58a6ff",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8b949e", fontStyle: "italic" },
        { token: "keyword", foreground: "ff7b72" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "function", foreground: "d2a8ff" },
        { token: "type", foreground: "ffa657" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editorCursor.foreground": "#58a6ff",
        "editor.lineHighlightBackground": "#161b2280",
        "editor.selectionBackground": "#1f6feb40",
      },
    },
  },
  "github-light": {
    id: "github-light",
    name: "GitHub Light",
    isDark: false,
    monacoBase: "vs",
    uiBg: "#ffffff",
    uiSidebar: "#f6f8fa",
    uiBorder: "#d0d7de",
    uiText: "#24292f",
    uiMuted: "#57606a",
    accent: "#0969da",
    monacoThemeData: {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6e7781", fontStyle: "italic" },
        { token: "keyword", foreground: "cf222e" },
        { token: "string", foreground: "0a3069" },
        { token: "number", foreground: "0550ae" },
        { token: "function", foreground: "8250df" },
        { token: "type", foreground: "953800" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#24292f",
        "editorCursor.foreground": "#0969da",
        "editor.lineHighlightBackground": "#f6f8fa",
        "editor.selectionBackground": "#add6ff80",
      },
    },
  },
  custom: {
    id: "custom",
    name: "Custom Theme",
    isDark: true,
    monacoBase: "vs-dark",
    uiBg: "#0f172a",
    uiSidebar: "#1e293b",
    uiBorder: "#334155",
    uiText: "#f8fafc",
    uiMuted: "#94a3b8",
    accent: "#38bdf8",
  },
};

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  background: "#0f172a",
  foreground: "#f8fafc",
  accent: "#38bdf8",
  sidebarBg: "#1e293b",
  editorBg: "#0b0f19",
  lineHighlight: "#1e293b55",
  selectionBg: "#38bdf833",
  cursorColor: "#38bdf8",
};

export function registerMonacoThemes(monaco: any) {
  if (!monaco) return;

  // Register each defined theme with Monaco
  Object.values(THEMES).forEach((theme) => {
    if (theme.monacoThemeData) {
      monaco.editor.defineTheme(theme.id, theme.monacoThemeData);
    }
  });
}

export function registerCustomMonacoTheme(monaco: any, custom: CustomThemeColors) {
  if (!monaco || !custom) return;

  // Determine if background is dark or light
  const isDark = isColorDark(custom.editorBg || custom.background);

  monaco.editor.defineTheme("custom", {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: isDark ? "94a3b8" : "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: custom.accent.replace("#", "") },
      { token: "string", foreground: isDark ? "34d399" : "059669" },
      { token: "number", foreground: isDark ? "fb923c" : "ea580c" },
      { token: "function", foreground: custom.accent.replace("#", "") },
    ],
    colors: {
      "editor.background": custom.editorBg || custom.background,
      "editor.foreground": custom.foreground,
      "editorCursor.foreground": custom.cursorColor || custom.accent,
      "editor.lineHighlightBackground": custom.lineHighlight || "#1e293b55",
      "editor.selectionBackground": custom.selectionBg || "#38bdf833",
    },
  });
}

function isColorDark(hexColor: string): boolean {
  if (!hexColor || !hexColor.startsWith("#")) return true;
  const hex = hexColor.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  } else if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return true;
}
