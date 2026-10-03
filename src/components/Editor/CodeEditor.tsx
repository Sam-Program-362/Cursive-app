"use client";

import React, { useEffect, useRef, useState } from "react";
import Editor, { OnMount, BeforeMount, loader } from "@monaco-editor/react";
import { EditorSettings, FileItem } from "@/types";
import { registerMonacoThemes, registerCustomMonacoTheme, THEMES } from "@/lib/themes";
import { registerLanguageProviders } from "@/lib/monaco-snippets";
import { Loader2 } from "lucide-react";

// Serve Monaco from files bundled with the app (copied into
// `public/monaco/vs` by `scripts/copy-monaco.mjs`) instead of the jsDelivr
// CDN. This is what lets the Android APK show the editor with no network and
// without loading the remote live site.
loader.config({ paths: { vs: "/monaco/vs" } });

interface CodeEditorProps {
  file: FileItem | null;
  settings: EditorSettings;
  onChange: (value: string) => void;
  onRun?: () => void;
  onOpenAI?: () => void;
  editorRefOut?: React.MutableRefObject<any>;
  /** All open files, used to suggest names that live in other Python files. */
  files?: FileItem[];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  settings,
  onChange,
  onRun,
  onOpenAI,
  editorRefOut,
  files = [],
}) => {
  const [isClient, setIsClient] = useState(false);
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const filesRef = useRef<FileItem[]>(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    registerMonacoThemes(monaco);
    registerLanguageProviders(monaco, {
      getOtherPythonSources: () =>
        filesRef.current
          .filter(
            (item) =>
              !item.isFolder &&
              item.language === "python" &&
              item.id !== file?.id
          )
          .map((item) => item.content || ""),
    });

    if (settings.theme === "custom") {
      registerCustomMonacoTheme(monaco, settings.customTheme);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (editorRefOut) {
      editorRefOut.current = editor;
    }

    // Register Keyboard Shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRun) onRun();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      if (onOpenAI) onOpenAI();
    });

    editor.focus();
  };

  // Keyboard-aware cursor reveal: when the on-screen keyboard opens/closes
  // (visualViewport resize), keep the caret line visible above the keyboard
  // instead of leaving it hidden behind it.
  useEffect(() => {
    const visualViewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!visualViewport) return;

    const revealCursor = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const position = editor.getPosition();
      if (!position) return;
      editor.revealLineInCenterIfOutsideViewport(position.lineNumber, 0);
    };

    visualViewport.addEventListener("resize", revealCursor);
    visualViewport.addEventListener("scroll", revealCursor);
    return () => {
      visualViewport.removeEventListener("resize", revealCursor);
      visualViewport.removeEventListener("scroll", revealCursor);
    };
  }, [isClient]);

  useEffect(() => {
    if (monacoRef.current && settings.theme === "custom") {
      registerCustomMonacoTheme(monacoRef.current, settings.customTheme);
      monacoRef.current.editor.setTheme("custom");
    }
  }, [settings.customTheme, settings.theme]);

  const activeMonacoTheme = settings.theme === "custom" ? "custom" : settings.theme;

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-950 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950/80 text-slate-500 p-6 text-center">
        <p className="text-sm font-medium">No file selected</p>
        <p className="text-xs text-slate-600 mt-1">Select or create a file in the sidebar to start coding</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={file.language || "plaintext"}
        value={file.content || ""}
        theme={activeMonacoTheme}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        onChange={(val) => onChange(val || "")}
        loading={
          <div className="flex items-center justify-center h-full gap-2 text-slate-400 bg-slate-950">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-xs">Loading Editor...</span>
          </div>
        }
        options={{
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          tabSize: settings.tabSize,
          wordWrap: settings.wordWrap,
          lineNumbers: settings.lineNumbers,
          minimap: { enabled: settings.minimap },
          cursorSmoothCaretAnimation: settings.cursorSmoothCaretAnimation,
          cursorBlinking: settings.cursorBlinking,
          autoIndent: settings.autoIndent,
          formatOnPaste: settings.formatOnPaste,
          formatOnType: settings.formatOnType,
          quickSuggestions: settings.quickSuggestions,
          parameterHints: { enabled: settings.parameterHints },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          // Read-only example files can be viewed and run but not edited.
          readOnly: Boolean(file.readOnly),
          scrollBeyondLastLine: true,
          smoothScrolling: true,
          renderWhitespace: settings.showInvisibles ? "all" : "selection",
          automaticLayout: true,
          padding: { top: 8, bottom: 320 },
          fontLigatures: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
      />
    </div>
  );
};
