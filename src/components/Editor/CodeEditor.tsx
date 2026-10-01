"use client";

import React, { useEffect, useRef, useState } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import { EditorSettings, FileItem } from "@/types";
import { registerMonacoThemes, registerCustomMonacoTheme, THEMES } from "@/lib/themes";
import {
  registerLanguageProviders,
  setPythonWorkspaceFiles,
} from "@/lib/monaco-snippets";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
  file: FileItem | null;
  settings: EditorSettings;
  onChange: (value: string) => void;
  onRun?: () => void;
  onOpenAI?: () => void;
  editorRefOut?: React.MutableRefObject<any>;
  /** Other open files are used for lightweight cross-file Python completion. */
  openFiles?: FileItem[];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  settings,
  onChange,
  onRun,
  onOpenAI,
  editorRefOut,
  openFiles = [],
}) => {
  const [isClient, setIsClient] = useState(false);
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setPythonWorkspaceFiles(openFiles);
  }, [openFiles]);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    registerMonacoThemes(monaco);
    registerLanguageProviders(monaco);

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

    // Mobile browsers resize the visual viewport (not always the layout
    // viewport) when the keyboard opens. Re-center the cursor after Monaco
    // has laid itself out so the line being edited stays above the keyboard.
    const revealCursorLine = () => {
      const position = editor.getPosition();
      if (!position) return;
      editor.layout();
      editor.revealLineInCenterIfOutsideViewport(position.lineNumber);
    };
    let revealFrame = 0;
    const revealAfterViewportChange = () => {
      window.cancelAnimationFrame(revealFrame);
      revealFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(revealCursorLine);
      });
    };
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", revealAfterViewportChange);
    visualViewport?.addEventListener("scroll", revealAfterViewportChange);
    window.addEventListener("resize", revealAfterViewportChange);
    editor.onDidFocusEditorText(revealAfterViewportChange);
    editor.onDidDispose(() => {
      visualViewport?.removeEventListener("resize", revealAfterViewportChange);
      visualViewport?.removeEventListener("scroll", revealAfterViewportChange);
      window.removeEventListener("resize", revealAfterViewportChange);
      window.cancelAnimationFrame(revealFrame);
    });

    editor.focus();
  };

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
          // Leave a large, touch-friendly tail after the final line. This lets
          // the last line scroll to the middle of the editor instead of being
          // hidden behind a finger or the on-screen keyboard.
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
