import {
  PYTHON_STDLIB_MODULES,
  PYTHON_MODULE_MEMBERS,
  PYTHON_BUILTINS,
  PYTHON_SNIPPETS,
  memberLabel,
} from "./python-intellisense";
import { getPythonCompletions } from "./runtime/pyodide-runner";

/**
 * Monaco Editor completion and hover providers for Python, JS, HTML, CSS.
 */
export interface ProviderContext {
  /** Source code of the other open files, used for cross-file Python names. */
  getOtherPythonSources?: () => string[];
}

/** Pull top-level def/class/assignment/import names out of other files. */
function collectCrossFileSymbols(sources: string[]): string[] {
  const names = new Set<string>();
  const patterns = [
    /^\s*(?:def|class)\s+([A-Za-z_]\w*)/gm,
    /^([A-Za-z_]\w*)\s*(?::[^=\n]+)?=/gm,
    /^\s*import\s+([A-Za-z_][\w.]*)/gm,
    /^\s*from\s+[\w.]+\s+import\s+([A-Za-z_]\w*)/gm,
  ];
  for (const source of sources) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        if (match[1]) names.add(match[1].split(".")[0]);
      }
    }
  }
  return Array.from(names);
}

/** Throttle Jedi so it runs at most a few times per second while typing. */
const JEDI_THROTTLE_MS = 250;
let lastJediAt = 0;

export function registerLanguageProviders(
  monaco: any,
  context: ProviderContext = {}
) {
  if (!monaco || (monaco as any).__codepadProvidersRegistered) return;
  (monaco as any).__codepadProvidersRegistered = true;

  // Python Completion Provider
  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: [".", " "],
    provideCompletionItems: async (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const snippetKind = monaco.languages.CompletionItemKind.Snippet;
      const snippetRule =
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

      const snippetItems = PYTHON_SNIPPETS.map((snippet) => ({
        label: snippet.label,
        kind: snippetKind,
        insertText: snippet.insertText,
        insertTextRules: snippetRule,
        documentation: snippet.documentation,
        sortText: `0_${snippet.label}`,
        range,
      }));

      const builtinItems = Object.entries(PYTHON_BUILTINS).map(
        ([name, signature]) => ({
          label: name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: name,
          detail: "builtin",
          documentation: `\`\`\`python\n${signature}\n\`\`\``,
          sortText: `1_${name}`,
          range,
        })
      );

      const moduleItems = PYTHON_STDLIB_MODULES.map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Module,
        insertText: name,
        detail: "standard library",
        sortText: `0_${name}`,
        range,
      }));

      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.slice(0, word.startColumn - 1);

      // `from <module> import ` → suggest that module's members.
      const fromImport = textBefore.match(
        /^\s*from\s+([\w.]+)\s+import\s+[\w, ]*$/
      );
      if (fromImport) {
        const members = PYTHON_MODULE_MEMBERS[fromImport[1]];
        if (members) {
          return {
            suggestions: members.map((entry) => {
              const label = memberLabel(entry);
              return {
                label,
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: label,
                detail: fromImport[1],
                documentation: `\`${entry}\``,
                sortText: `0_${label}`,
                range,
              };
            }),
          };
        }
      }

      // `import` / `import m` / `from` → suggest standard-library module names.
      if (/^\s*(?:from|import)\s*[\w.]*$/.test(textBefore)) {
        return { suggestions: moduleItems };
      }

      // `<name>.` → suggest members of a known module / imported module.
      const memberAccess = textBefore.match(/([A-Za-z_]\w*)\.\w*$/);
      if (memberAccess) {
        const members = PYTHON_MODULE_MEMBERS[memberAccess[1]];
        if (members) {
          return {
            suggestions: members.map((entry) => {
              const label = memberLabel(entry);
              return {
                label,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: label,
                detail: memberAccess[1],
                documentation: `\`${entry}\``,
                sortText: `0_${label}`,
                range,
              };
            }),
          };
        }
      }

      const crossFileItems = collectCrossFileSymbols(
        context.getOtherPythonSources?.() ?? []
      ).map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: name,
        detail: "other file",
        sortText: `2_${name}`,
        range,
      }));

      const suggestions: any[] = [
        ...snippetItems,
        ...builtinItems,
        ...crossFileItems,
      ];

      // Phase 2: layer Jedi on top, but only once Python has already been
      // run in this session (never triggers the Pyodide download itself).
      const now = Date.now();
      const wordText = word.word || "";
      if (
        context.getOtherPythonSources &&
        now - lastJediAt >= JEDI_THROTTLE_MS &&
        (wordText.length >= 2 || memberAccess !== null)
      ) {
        lastJediAt = now;
        try {
          const jediItems = await getPythonCompletions(
            model.getValue(),
            position.lineNumber,
            position.column - 1
          );
          const seen = new Set(suggestions.map((s) => s.label));
          for (const item of jediItems) {
            if (!item.label || seen.has(item.label)) continue;
            seen.add(item.label);
            suggestions.push({
              label: item.label,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: item.label,
              detail: "jedi",
              sortText: `3_${item.label}`,
              range,
            });
          }
        } catch {
          /* Jedi is best-effort only. */
        }
      }

      return { suggestions };
    },
  });

  // Python Hover Provider
  monaco.languages.registerHoverProvider("python", {
    provideHover: (model: any, position: any) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const hints: Record<string, string> = {
        print: "```python\nprint(*objects, sep=' ', end='\\n', file=None, flush=False)\n```\nPrints values to a stream or sys.stdout by default.",
        len: "```python\nlen(s) -> int\n```\nReturn the number of items in a container (list, tuple, string, dict, set).",
        range: "```python\nrange(stop) -> range object\nrange(start, stop[, step]) -> range object\n```\nReturn a sequence of numbers from start to stop by step.",
        sum: "```python\nsum(iterable, /, start=0) -> number\n```\nReturn the sum of all elements in an iterable plus the start value.",
        map: "```python\nmap(func, *iterables) -> map object\n```\nMake an iterator that computes the function using arguments from each of the iterables.",
        filter: "```python\nfilter(function_or_none, iterable) -> filter object\n```\nReturn an iterator yielding those items of iterable for which function(item) is true.",
      };

      if (hints[word.word]) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [{ value: hints[word.word] }],
        };
      }
      return null;
    },
  });

  // JavaScript / TypeScript Completion Provider
  const jsSnippets = [
    {
      label: "clg (console.log)",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "console.log(${1:item});",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Log output to the browser / Node console",
    },
    {
      label: "afn (arrow function)",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "const ${1:name} = (${2:params}) => {\n  ${0}\n};",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Create an arrow function constant",
    },
    {
      label: "async function",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "async function ${1:name}(${2:params}) {\n  ${0}\n}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Declare an asynchronous function",
    },
    {
      label: "fetch api call",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        "const res = await fetch('${1:https://api.example.com}');\nconst data = await res.json();\nconsole.log(data);",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Async fetch JSON request pattern",
    },
    {
      label: "try...catch",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        "try {\n  ${1}\n} catch (error) {\n  console.error(error);\n}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Try-catch exception handling block",
    },
  ];

  ["javascript", "typescript"].forEach((lang) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: jsSnippets.map((s) => ({ ...s, range })),
        };
      },
    });
  });

  // HTML Completion Provider
  monaco.languages.registerCompletionItemProvider("html", {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        {
          label: "html:5 boilerplate",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText:
            "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>${1:Document}</title>\n</head>\n<body>\n  ${0}\n</body>\n</html>",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Standard HTML5 Starter Document",
          range,
        },
        {
          label: "div.container",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "<div class=\"${1:container}\">\n  ${0}\n</div>",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Div with CSS class",
          range,
        },
        {
          label: "button",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "<button type=\"${1:button}\" onclick=\"${2:handleClick()}\">${3:Click}</button>",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "HTML Button Element",
          range,
        },
      ];

      return { suggestions };
    },
  });
}
