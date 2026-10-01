"use client";

import type { FileItem } from "@/types";
import { loadPythonRuntime } from "@/lib/runtime/pyodide-runner";

/**
 * Monaco completion, hover, and snippet providers.
 *
 * The static Python index deliberately lives in the browser: it works before
 * Pyodide/Jedi has downloaded, is useful offline, and keeps normal typing
 * responsive. Jedi is an optional, lazy second pass for Python dot-completion
 * and Ctrl+Space (see `getJediCompletions`).
 */

let workspaceFiles: FileItem[] = [];
let jediPromise: Promise<any> | null = null;
let jediDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingJediResolve: ((items: any[]) => void) | null = null;

/** Called by CodeEditor when the set of open files changes. */
export function setCompletionWorkspace(files: FileItem[] = []) {
  workspaceFiles = files;
}

// Python 3.12's documented standard-library top-level modules. Keeping this
// list local means `import` completion works without downloading Python first.
const PYTHON_STDLIB_MODULES = `
_abc _ast _asyncio _bisect _blake2 _bz2 _codecs _codecs_cn _codecs_hk
_codecs_iso2022 _codecs_jp _codecs_kr _codecs_tw _collections _collections_abc
_compat_pickle _compression _contextvars _crypt _csv _datetime _dbm _decimal
_elementtree _frozen_importlib _frozen_importlib_external _functools _heapq _imp
_io _json _locale _lzma _markupbase _md5 _multibytecodec _opcode _operator
_pickle _posixshmem _posixsubprocess _py_abc _pydecimal _pyio _pylong _queue
_random _sha1 _sha2 _sha3 _signal _sitebuiltins _socket _sqlite3 _sre _ssl
_stat _statistics _string _strptime _struct _symtable _thread _threading_local
_tkinter _tokenize _tracemalloc _typing _uuid _warnings _weakref _weakrefset
_winapi _zoneinfo abc aifc argparse array ast asyncio atexit audioop base64 bdb
binascii bisect builtins bz2 cProfile calendar cgi cgitb chunk cmath cmd code
codecs codeop collections colorsys compileall concurrent configparser contextlib
contextvars copy copyreg crypt csv ctypes curses dataclasses datetime dbm decimal
difflib dis doctest email encodings ensurepip enum errno faulthandler fcntl
filecmp fileinput fnmatch fractions ftplib functools gc getopt getpass gettext
glob graphlib grp gzip hashlib heapq hmac html http idlelib imaplib imghdr
importlib inspect io ipaddress itertools json keyword lib2to3 linecache locale
logging lzma mailbox mailcap marshal math mimetypes mmap modulefinder
multiprocessing netrc nis nntplib numbers operator optparse os pathlib pdb pickle
pickletools pipes pkgutil platform plistlib poplib posix pprint profile pstats pty
pwd py_compile pyclbr pydoc queue quopri random re readline reprlib resource
rlcompleter runpy sched secrets select selectors shelve shutil signal site smtpd
smtplib sndhdr socket socketserver spwd sqlite3 sre_compile sre_constants sre_parse
ssl stat statistics string stringprep struct subprocess sunau symtable sys sysconfig
syslog tabnanny tarfile telnetlib tempfile termios textwrap threading time timeit
tkinter token tokenize tomllib trace traceback tracemalloc tty turtle types typing
unicodedata unittest urllib uuid venv warnings wave weakref webbrowser winreg
winsound wsgiref xdrlib xml xmlrpc zipapp zipfile zipimport zlib zoneinfo
`.trim().split(/\s+/);

const COMMON_MODULE_MEMBERS: Record<string, string[]> = {
  math: `
    acos acosh asin asinh atan atan2 atanh cbrt ceil comb copysign cos cosh
    degrees dist e erf erfc exp exp2 expm1 fabs factorial floor fmod frexp fsum
    gamma gcd hypot isclose isfinite isinf isnan isqrt lcm ldexp lgamma log
    log10 log1p log2 modf nextafter perm pi pow radians remainder sin sinh sqrt
    tan tanh tau trunc ulp inf nan
  `.trim().split(/\s+/),
  random: `
    Random SystemRandom choice choices randbytes randint randrange sample seed
    getstate setstate shuffle triangular uniform betavariate expovariate
    gammavariate gauss lognormvariate normalvariate vonmisesvariate
    paretovariate weibullvariate
  `.trim().split(/\s+/),
  os: `
    name environ getcwd chdir listdir mkdir makedirs makedtemp remove unlink
    rename replace rmdir walk stat lstat chmod access path sep linesep devnull
    getpid cpu_count urandom system
  `.trim().split(/\s+/),
  sys: `
    argv path modules version version_info platform stdin stdout stderr exit
    exc_info getsizeof maxsize byteorder executable implementation flags
    setrecursionlimit getrecursionlimit
  `.trim().split(/\s+/),
  json: `
    dump dumps load loads JSONEncoder JSONDecoder JSONDecodeError JSONDecodeError
    detect_encoding tool
  `.trim().split(/\s+/),
  time: `
    time monotonic perf_counter process_time sleep ctime gmtime localtime
    mktime strftime strptime time_ns monotonic_ns perf_counter_ns
  `.trim().split(/\s+/),
  datetime: `
    date datetime time timedelta timezone tzinfo MAXYEAR MINYEAR now today
    strptime fromtimestamp utcnow combine
  `.trim().split(/\s+/),
  re: `
    compile search match fullmatch split findall finditer sub subn escape purge
    Pattern Match RegexFlag IGNORECASE MULTILINE DOTALL VERBOSE ASCII
  `.trim().split(/\s+/),
  collections: `
    Counter defaultdict deque namedtuple OrderedDict UserDict UserList UserString
    ChainMap abc
  `.trim().split(/\s+/),
  itertools: `
    count cycle repeat accumulate batched chain compress dropwhile takewhile
    filterfalse groupby islice pairwise permutations product starmap tee zip_longest
  `.trim().split(/\s+/),
  functools: `
    cache cached_property cmp_to_key lru_cache partial partialmethod reduce
    singledispatch singledispatchmethod wraps update_wrapper
  `.trim().split(/\s+/),
  pathlib: `
    Path PurePath PurePosixPath PureWindowsPath PosixPath WindowsPath
  `.trim().split(/\s+/),
  string: `
    ascii_letters ascii_lowercase ascii_uppercase digits hexdigits octdigits
    punctuation printable whitespace Formatter Template capwords
  `.trim().split(/\s+/),
  statistics: `
    mean fmean geometric_mean harmonic_mean median median_grouped median_high
    median_low mode multimode quantiles pstdev pvariance stdev variance
  `.trim().split(/\s+/),
  typing: `
    Any Callable ClassVar Concatenate Final Generic Literal NamedTuple NewType
    Never NoReturn NotRequired ParamSpec Protocol Required Type TypeAlias
    TypeGuard TypeVar TypedDict Unpack cast get_args get_origin overload runtime_checkable
  `.trim().split(/\s+/),
  urllib: `
    request response parse error robotparser
  `.trim().split(/\s+/),
  csv: `
    reader writer DictReader DictWriter Error QUOTE_ALL QUOTE_MINIMAL QUOTE_NONE
    QUOTE_NONNUMERIC register_dialect unregister_dialect list_dialects field_size_limit
  `.trim().split(/\s+/),
  sqlite3: `
    connect Connection Cursor Row DatabaseError IntegrityError OperationalError
    ProgrammingError InterfaceError Warning Error PARSE_DECLTYPES PARSE_COLNAMES
  `.trim().split(/\s+/),
};

const PYTHON_BUILTINS: Array<[string, string, string]> = [
  ["print", "print(${1:*objects})", "print(*objects, sep=' ', end='\\n', file=None, flush=False)"],
  ["input", "input(${1:prompt})", "input(prompt='') -> str"],
  ["len", "len(${1:object})", "len(obj, /) -> int"],
  ["range", "range(${1:stop})", "range(stop) or range(start, stop[, step])"],
  ["enumerate", "enumerate(${1:iterable}, start=${2:0})", "enumerate(iterable, start=0)"],
  ["zip", "zip(${1:*iterables})", "zip(*iterables, strict=False)"],
  ["map", "map(${1:function}, ${2:iterable})", "map(function, iterable, /)"],
  ["filter", "filter(${1:function}, ${2:iterable})", "filter(function_or_none, iterable)"],
  ["sorted", "sorted(${1:iterable})", "sorted(iterable, /, *, key=None, reverse=False)"],
  ["sum", "sum(${1:iterable})", "sum(iterable, /, start=0)"],
  ["min", "min(${1:iterable})", "min(iterable, *, key=None, default=...)"],
  ["max", "max(${1:iterable})", "max(iterable, *, key=None, default=...)"],
  ["abs", "abs(${1:number})", "abs(number) -> number"],
  ["all", "all(${1:iterable})", "all(iterable, /) -> bool"],
  ["any", "any(${1:iterable})", "any(iterable, /) -> bool"],
  ["isinstance", "isinstance(${1:object}, ${2:class_or_tuple})", "isinstance(obj, class_or_tuple) -> bool"],
  ["open", "open(${1:file}, ${2:mode='r'})", "open(file, mode='r', ...) -> file object"],
  ["type", "type(${1:object})", "type(obj, /) -> type"],
  ["super", "super(${1:class}, ${2:self})", "super(type, obj) -> proxy"],
  ["getattr", "getattr(${1:object}, ${2:name})", "getattr(object, name[, default])"],
  ["setattr", "setattr(${1:object}, ${2:name}, ${3:value})", "setattr(object, name, value)"],
  ["dir", "dir(${1:object})", "dir([object]) -> list of attributes"],
  ["vars", "vars(${1:object})", "vars([object]) -> dict"],
];

const PYTHON_SNIPPETS = [
  {
    label: "def function",
    insertText: "def ${1:function_name}(${2:params}):\n    ${0:pass}",
    documentation: "Define a function with parameters and a body",
  },
  {
    label: "class",
    insertText: "class ${1:ClassName}:\n    def __init__(self, ${2:params}):\n        ${0:pass}",
    documentation: "Define a class with an __init__ constructor",
  },
  {
    label: "for in range",
    insertText: "for ${1:i} in range(${2:10}):\n    ${0:print(i)}",
    documentation: "Iterate over a numeric range",
  },
  {
    label: "for item in iterable",
    insertText: "for ${1:item} in ${2:iterable}:\n    ${0:pass}",
    documentation: "Iterate over an iterable",
  },
  {
    label: "while loop",
    insertText: "while ${1:condition}:\n    ${0:pass}",
    documentation: "Create a while loop",
  },
  {
    label: "try...except",
    insertText: "try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${0:print(e)}",
    documentation: "Try-except error handling block",
  },
  {
    label: "with open file",
    insertText: "with open(${1:'file.txt'}, ${2:'r'}) as ${3:file}:\n    ${0:content = file.read()}",
    documentation: "Open a file safely with a context manager",
  },
  {
    label: "if __name__ == '__main__'",
    insertText: "if __name__ == \"__main__\":\n    ${0:main()}",
    documentation: "Standard Python entrypoint boilerplate",
  },
];

function completionRange(monaco: any, model: any, position: any) {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

function escapedIdentifierNames(code: string): Set<string> {
  const names = new Set<string>();
  const definition = /^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/gm;
  const assignment = /^\s*([A-Za-z_]\w*)\s*=\s*/gm;
  let match: RegExpExecArray | null;
  while ((match = definition.exec(code))) names.add(match[1]);
  while ((match = assignment.exec(code))) names.add(match[1]);
  return names;
}

function importedAliases(code: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const line of code.split("\n")) {
    const importMatch = line.match(/^\s*import\s+(.+)$/);
    if (importMatch) {
      for (const part of importMatch[1].split(",")) {
        const [moduleName, alias] = part.trim().split(/\s+as\s+/);
        if (moduleName) aliases[alias || moduleName.split(".")[0]] = moduleName;
      }
    }
    const fromMatch = line.match(/^\s*from\s+([\w.]+)\s+import\s+(.+)$/);
    if (fromMatch) {
      for (const part of fromMatch[2].split(",")) {
        const [name, alias] = part.trim().split(/\s+as\s+/);
        if (name) aliases[alias || name] = `${fromMatch[1]}.${name}`;
      }
    }
  }
  return aliases;
}

function moduleMembers(moduleName: string, code: string): string[] {
  const aliases = importedAliases(code);
  const resolved = aliases[moduleName] || moduleName;
  // `urllib.request` is imported as a submodule surprisingly often.
  return COMMON_MODULE_MEMBERS[resolved] || COMMON_MODULE_MEMBERS[resolved.split(".")[0]] || [];
}

function staticPythonSuggestions(monaco: any, model: any, position: any) {
  const linePrefix = model
    .getLineContent(position.lineNumber)
    .slice(0, Math.max(0, position.column - 1));
  const range = completionRange(monaco, model, position);
  const code = model.getValue();
  const suggestions: any[] = [];
  const kind = monaco.languages.CompletionItemKind;
  const add = (item: any) => suggestions.push({ ...item, range });

  const importStatement = linePrefix.match(/^\s*import\s+([\w., ]*)$/);
  const fromModuleStatement = linePrefix.match(/^\s*from\s+([\w.]*)$/);
  const fromImportStatement = linePrefix.match(
    /^\s*from\s+([\w.]+)\s+import\s+([\w]*)$/
  );
  const dotStatement = linePrefix.match(/(?:^|\s|\()([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);

  if (importStatement || fromModuleStatement) {
    const modulePrefix = (importStatement?.[1] || fromModuleStatement?.[1] || "")
      .split(/[,. ]/)
      .pop() || "";
    for (const moduleName of PYTHON_STDLIB_MODULES) {
      add({
        label: moduleName,
        kind: kind.Module,
        insertText: moduleName,
        filterText: moduleName,
        detail: "Python 3.12 standard library",
        sortText: moduleName.startsWith(modulePrefix) ? `0_${moduleName}` : `1_${moduleName}`,
      });
    }
  }

  if (fromImportStatement) {
    const prefix = fromImportStatement[2];
    for (const member of moduleMembers(fromImportStatement[1], code)) {
      add({
        label: member,
        kind: kind.Field,
        insertText: member,
        filterText: member,
        detail: `${fromImportStatement[1]} member`,
        sortText: member.startsWith(prefix) ? `0_${member}` : `1_${member}`,
      });
    }
  }

  if (dotStatement) {
    const moduleName = dotStatement[1];
    const prefix = dotStatement[2] || "";
    for (const member of moduleMembers(moduleName, code)) {
      add({
        label: member,
        kind: kind.Method,
        insertText: member,
        filterText: member,
        detail: `${importedAliases(code)[moduleName] || moduleName} member`,
        sortText: member.startsWith(prefix) ? `0_${member}` : `1_${member}`,
      });
    }
  }

  for (const builtin of PYTHON_BUILTINS) {
    add({
      label: builtin[0],
      kind: kind.Function,
      insertText: builtin[1],
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: builtin[2],
      detail: builtin[2],
    });
  }

  for (const snippet of PYTHON_SNIPPETS) {
    add({
      label: snippet.label,
      kind: kind.Snippet,
      insertText: snippet.insertText,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: snippet.documentation,
    });
  }

  // Names from the other open files make small multi-file projects pleasant
  // to use even while Jedi is still downloading.
  const currentUri = model.uri?.toString?.();
  for (const file of workspaceFiles) {
    if (file.isFolder || file.language !== "python") continue;
    if (currentUri && file.path === currentUri) continue;
    for (const name of Array.from(escapedIdentifierNames(file.content))) {
      add({
        label: name,
        kind: kind.Function,
        insertText: name,
        detail: `Defined in ${file.name}`,
        documentation: `A name defined in ${file.name}`,
      });
    }
  }

  return suggestions;
}

function completionKind(monaco: any, type: string) {
  const kind = monaco.languages.CompletionItemKind;
  if (type === "function" || type === "method") return kind.Function;
  if (type === "class" || type === "instance") return kind.Class;
  if (type === "module") return kind.Module;
  if (type === "keyword") return kind.Keyword;
  if (type === "statement") return kind.Keyword;
  return kind.Variable;
}

/**
 * Load Jedi only after a dot or an explicit completion invocation. The
 * 250ms debounce prevents a burst of Monaco provider calls on mobile from
 * repeatedly entering Pyodide while the user is still typing.
 */
function getJediCompletions(monaco: any, model: any, position: any): Promise<any[]> {
  if (jediDebounceTimer) clearTimeout(jediDebounceTimer);
  pendingJediResolve?.([]);

  return new Promise((resolve) => {
    pendingJediResolve = resolve;
    jediDebounceTimer = setTimeout(async () => {
      pendingJediResolve = null;
      try {
        const pyodide = jediPromise
          ? await jediPromise
          : (jediPromise = loadPythonRuntime()
              .then(async (runtime: any) => {
                if (typeof runtime.loadPackage !== "function") {
                  throw new Error("This Pyodide build cannot load Jedi packages.");
                }
                await runtime.loadPackage("jedi");
                return runtime;
              })
              .catch((error) => {
                jediPromise = null;
                throw error;
              }));

        const code = JSON.stringify(model.getValue());
        const line = position.lineNumber;
        // Jedi columns are zero-based; Monaco columns are one-based.
        const column = Math.max(0, position.column - 1);
        const raw = pyodide.runPython(`
import json, jedi
_completions = jedi.Script(${code}).complete(${line}, ${column})
json.dumps([
    {"name": item.name, "type": item.type,
     "description": getattr(item, "description", "")}
    for item in _completions
])
`);
        const parsed = JSON.parse(String(raw)) as Array<{
          name: string;
          type: string;
          description: string;
        }>;
        const range = completionRange(monaco, model, position);
        resolve(
          parsed.map((item) => ({
            label: item.name,
            kind: completionKind(monaco, item.type),
            insertText: item.name,
            detail: `Jedi ${item.type}`,
            documentation: item.description,
            range,
          }))
        );
      } catch {
        // Static completions remain useful if the optional Jedi package or
        // network download is unavailable. Do not interrupt typing with an
        // error toast or an unhandled promise rejection.
        resolve([]);
      } finally {
        jediDebounceTimer = null;
      }
    }, 250);
  });
}

function uniqueSuggestions(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}|${item.detail || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function registerLanguageProviders(monaco: any, files: FileItem[] = []) {
  setCompletionWorkspace(files);
  if (!monaco || (monaco as any).__codepadProvidersRegistered) return;
  (monaco as any).__codepadProvidersRegistered = true;

  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: ["."],
    provideCompletionItems: async (model: any, position: any, _context: any) => {
      const linePrefix = model
        .getLineContent(position.lineNumber)
        .slice(0, Math.max(0, position.column - 1));
      const staticSuggestions = staticPythonSuggestions(monaco, model, position);
      const explicitlyRequested =
        _context?.triggerKind === monaco.languages.CompletionTriggerKind?.Invoke;
      const typedDot = /[A-Za-z_]\w*\.$/.test(linePrefix);

      if (typedDot || explicitlyRequested) {
        const jediSuggestions = await getJediCompletions(monaco, model, position);
        return { suggestions: uniqueSuggestions([...jediSuggestions, ...staticSuggestions]) };
      }
      return { suggestions: uniqueSuggestions(staticSuggestions) };
    },
  });

  monaco.languages.registerHoverProvider("python", {
    provideHover: (model: any, position: any) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const hints: Record<string, string> = {
        print: "```python\nprint(*objects, sep=' ', end='\\n', file=None, flush=False)\n```\nPrint values to a stream or sys.stdout by default.",
        input: "```python\ninput(prompt='') -> str\n```\nRead a line from the terminal and return it as a string.",
        len: "```python\nlen(s) -> int\n```\nReturn the number of items in a container.",
        range: "```python\nrange(stop) -> range object\nrange(start, stop[, step]) -> range object\n```\nReturn a sequence of numbers.",
        sum: "```python\nsum(iterable, /, start=0) -> number\n```\nReturn the sum of all elements in an iterable.",
        open: "```python\nopen(file, mode='r', ...) -> file object\n```\nOpen a file, optionally for reading or writing.",
      };

      if (!hints[word.word]) return null;
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: [{ value: hints[word.word] }],
      };
    },
  });

  // JavaScript / TypeScript suggestions stay available independently of the
  // Python engine and its optional Pyodide download.
  const jsSnippets = [
    {
      label: "clg (console.log)",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "console.log(${1:item});",
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Log output to the browser / Node console",
    },
    {
      label: "afn (arrow function)",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "const ${1:name} = (${2:params}) => {\n  ${0}\n};",
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Create an arrow function constant",
    },
    {
      label: "async function",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "async function ${1:name}(${2:params}) {\n  ${0}\n}",
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Declare an asynchronous function",
    },
    {
      label: "fetch api call",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "const res = await fetch('${1:https://api.example.com}');\nconst data = await res.json();\nconsole.log(data);",
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Async fetch JSON request pattern",
    },
    {
      label: "try...catch",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "try {\n  ${1}\n} catch (error) {\n  console.error(error);\n}",
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Try-catch exception handling block",
    },
  ];

  ["javascript", "typescript"].forEach((language) => {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model: any, position: any) => ({
        suggestions: jsSnippets.map((item) => ({
          ...item,
          range: completionRange(monaco, model, position),
        })),
      }),
    });
  });

  monaco.languages.registerCompletionItemProvider("html", {
    provideCompletionItems: (model: any, position: any) => {
      const range = completionRange(monaco, model, position);
      const suggestions = [
        {
          label: "html:5 boilerplate",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>${1:Document}</title>\n</head>\n<body>\n  ${0}\n</body>\n</html>",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Standard HTML5 starter document",
          range,
        },
        {
          label: "div.container",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "<div class=\"${1:container}\">\n  ${0}\n</div>",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Div with a CSS class",
          range,
        },
        {
          label: "button",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "<button type=\"${1:button}\" onclick=\"${2:handleClick()}\">${3:Click}</button>",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "HTML button element",
          range,
        },
      ];
      return { suggestions };
    },
  });

  monaco.languages.registerCompletionItemProvider("css", {
    provideCompletionItems: (model: any, position: any) => ({
      suggestions: [
        ["display flex", "display: flex;", "Use Flexbox layout"],
        ["display grid", "display: grid;", "Use CSS Grid layout"],
        ["media query", "@media (max-width: ${1:768px}) {\n  ${0}\n}", "Responsive media query"],
        ["var", "var(--${1:color})", "Use a CSS custom property"],
        ["transition", "transition: ${1:all 0.2s ease};", "Animate CSS property changes"],
      ].map(([label, insertText, documentation]) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation,
        range: completionRange(monaco, model, position),
      })),
    }),
  });
}
