/**
 * Monaco completion and hover providers.
 *
 * Monaco's built-in Python language service intentionally stays small in the
 * browser.  The provider below adds useful Python 3.12 library knowledge
 * without making the initial page load download a second runtime.  Jedi is
 * loaded lazily by the Pyodide runner after the user asks for a dot/member
 * completion (or invokes suggestions).
 */
import { runJediCompletion, JediCompletion } from "@/lib/runtime/pyodide-runner";

type WorkspaceFile = {
  id?: string;
  name: string;
  path?: string;
  language?: string;
  content: string;
  isFolder?: boolean;
};

let pythonWorkspaceFiles: WorkspaceFile[] = [];

/** Keep the provider's view of the currently open files up to date. */
export function setPythonWorkspaceFiles(files: WorkspaceFile[]) {
  pythonWorkspaceFiles = files.filter(
    (file) => !file.isFolder && file.language === "python" || (!file.isFolder && file.name.endsWith(".py"))
  );
}

// Python's documented standard-library top-level modules for Python 3.12.
// This is deliberately a static list: it is available immediately and does
// not require executing user code or downloading Pyodide.
const PYTHON_STDLIB_MODULES = [
  "__future__", "_abc", "_ast", "_codecs", "_collections", "_functools",
  "_io", "_locale", "_operator", "_signal", "_sitebuiltins", "_sre",
  "_stat", "_string", "_symtable", "_thread", "_tokenize", "_tracemalloc",
  "_warnings", "_weakref", "abc", "aifc", "argparse", "array", "ast",
  "asyncio", "atexit", "audioop", "base64", "bdb", "binascii", "bisect",
  "builtins", "bz2", "calendar", "cgi", "cgitb", "chunk", "cmath", "cmd",
  "code", "codecs", "codeop", "collections", "colorsys", "compileall",
  "concurrent", "configparser", "contextlib", "contextvars", "copy", "copyreg",
  "cProfile", "crypt", "csv", "ctypes", "curses", "dataclasses", "datetime",
  "dbm", "decimal", "difflib", "dis", "email", "encodings", "enum", "errno",
  "faulthandler", "fcntl", "filecmp", "fileinput", "fnmatch", "fractions",
  "ftplib", "functools", "gc", "getopt", "getpass", "gettext", "glob",
  "graphlib", "gzip", "hashlib", "heapq", "hmac", "html", "http", "imaplib",
  "imghdr", "importlib", "inspect", "io", "ipaddress", "itertools", "json",
  "keyword", "linecache", "locale", "logging", "lzma", "mailbox", "marshal",
  "math", "mimetypes", "mmap", "modulefinder", "multiprocessing", "netrc", "nis",
  "nntplib", "numbers", "operator", "optparse", "os", "ossaudiodev", "pathlib",
  "pdb", "pickle", "pickletools", "pkgutil", "platform", "plistlib", "poplib",
  "posix", "pprint", "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr",
  "pydoc", "queue", "quopri", "random", "readline", "reprlib", "resource",
  "rlcompleter", "runpy", "sched", "secrets", "select", "selectors", "shelve",
  "shlex", "shutil", "signal", "site", "smtpd", "smtplib", "sndhdr", "socket",
  "socketserver", "sqlite3", "ssl", "stat", "statistics", "string", "stringprep",
  "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig", "syslog",
  "tabnanny", "tarfile", "telnetlib", "tempfile", "textwrap", "threading", "time",
  "timeit", "tkinter", "token", "tokenize", "tomllib", "trace", "traceback",
  "tracemalloc", "tty", "turtle", "turtledemo", "types", "typing", "unicodedata",
  "unittest", "urllib", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser",
  "winreg", "winsound", "wsgiref", "xdrlib", "xml", "xmlrpc", "zipapp", "zipfile",
  "zipimport", "zlib",
];

const MODULE_MEMBERS: Record<string, string[]> = {
  math: [
    "pi", "e", "tau", "inf", "nan", "ceil(x)", "comb(n, k)", "copysign(x, y)",
    "fabs(x)", "factorial(n)", "floor(x)", "fmod(x, y)", "gcd(*integers)",
    "isclose(a, b)", "isfinite(x)", "isinf(x)", "isnan(x)", "lcm(*integers)",
    "log(x, base)", "log10(x)", "pow(x, y)", "sqrt(x)", "exp(x)", "sin(x)",
    "cos(x)", "tan(x)", "degrees(x)", "radians(x)", "hypot(*coordinates)",
  ],
  random: [
    "seed(a)", "random()", "randint(a, b)", "randrange(start, stop, step)",
    "choice(seq)", "choices(population, k)", "sample(population, k)", "shuffle(x)",
    "uniform(a, b)", "getrandbits(k)", "Random", "SystemRandom",
  ],
  os: [
    "name", "environ", "getcwd()", "chdir(path)", "listdir(path)", "mkdir(path)",
    "makedirs(name)", "remove(path)", "rename(src, dst)", "replace(src, dst)",
    "walk(top)", "path", "sep", "linesep", "stat(path)", "fspath(path)",
    "PathLike", "urandom(size)",
  ],
  sys: [
    "argv", "path", "modules", "version", "platform", "stdin", "stdout", "stderr",
    "exit(code)", "maxsize", "executable", "getsizeof(object)", "getrecursionlimit()",
    "setrecursionlimit(limit)", "getdefaultencoding()",
  ],
  json: [
    "dump(obj, fp)", "dumps(obj)", "load(fp)", "loads(s)", "JSONEncoder", "JSONDecoder",
    "JSONDecodeError", "JSONDecodeError",
  ],
  time: [
    "time()", "sleep(seconds)", "monotonic()", "perf_counter()", "process_time()",
    "strftime(format)", "strptime(string, format)", "localtime(seconds)", "gmtime(seconds)",
    "ctime(seconds)", "time_ns()",
  ],
  datetime: [
    "date", "datetime", "time", "timedelta", "timezone", "tzinfo", "MINYEAR", "MAXYEAR",
    "date.today()", "datetime.now()", "datetime.fromisoformat(date_string)",
  ],
  re: [
    "compile(pattern, flags)", "search(pattern, string)", "match(pattern, string)",
    "fullmatch(pattern, string)", "findall(pattern, string)", "finditer(pattern, string)",
    "split(pattern, string)", "sub(pattern, repl, string)", "escape(pattern)",
    "Pattern", "Match", "IGNORECASE", "MULTILINE", "DOTALL",
  ],
  collections: [
    "Counter", "defaultdict", "deque", "namedtuple", "OrderedDict", "ChainMap",
    "UserDict", "UserList", "UserString", "abc",
  ],
  itertools: [
    "count(start)", "cycle(iterable)", "repeat(object, times)", "accumulate(iterable)",
    "chain(*iterables)", "compress(data, selectors)", "dropwhile(predicate, iterable)",
    "filterfalse(predicate, iterable)", "groupby(iterable, key)", "islice(iterable, stop)",
    "permutations(iterable, r)", "product(*iterables)", "starmap(function, iterable)",
    "takewhile(predicate, iterable)", "tee(iterable, n)", "zip_longest(*iterables)",
  ],
  functools: [
    "cache(user_function)", "cached_property(func)", "cmp_to_key(mycmp)", "lru_cache(maxsize)",
    "partial(func, /, *args, **keywords)", "reduce(function, iterable)", "wraps(wrapped)",
  ],
  pathlib: [
    "Path", "PurePath", "PurePosixPath", "PureWindowsPath", "PosixPath", "WindowsPath",
    "Path.cwd()", "Path.home()", "Path.glob(pattern)", "Path.read_text()", "Path.write_text(data)",
    "Path.exists()", "Path.is_file()", "Path.is_dir()", "Path.iterdir()", "Path.mkdir()",
  ],
  string: [
    "ascii_letters", "ascii_lowercase", "ascii_uppercase", "digits", "hexdigits", "octdigits",
    "punctuation", "printable", "whitespace", "Template", "Formatter", "capwords(s)",
  ],
  statistics: [
    "mean(data)", "fmean(data)", "geometric_mean(data)", "harmonic_mean(data)", "median(data)",
    "median_low(data)", "median_high(data)", "mode(data)", "multimode(data)", "pstdev(data)",
    "pvariance(data)", "stdev(data)", "variance(data)", "quantiles(data)",
  ],
  typing: [
    "Any", "Callable", "ClassVar", "Final", "Generic", "Literal", "NamedTuple", "Never",
    "NewType", "NoReturn", "Optional", "Protocol", "Type", "TypeVar", "TypedDict",
    "Union", "cast(typ, val)", "get_args(tp)", "get_origin(tp)", "runtime_checkable",
  ],
  urllib: ["request", "parse", "error", "robotparser", "parse.urlencode(query)", "parse.urlparse(url)"],
  csv: ["reader(csvfile)", "writer(csvfile)", "DictReader(f)", "DictWriter(f, fieldnames)", "QUOTE_MINIMAL", "Error"],
  sqlite3: ["connect(database)", "Connection", "Cursor", "Row", "Error", "OperationalError", "PARSE_DECLTYPES"],
};

const PYTHON_BUILTINS: Array<{ name: string; signature: string; documentation: string }> = [
  ["print", "print(*objects, sep=' ', end='\\n', file=None, flush=False)", "Write objects to stdout."],
  ["input", "input(prompt='') -> str", "Read one line of text from the user."],
  ["open", "open(file, mode='r', buffering=-1, encoding=None)", "Open a file and return a file object."],
  ["len", "len(s) -> int", "Return the number of items in a container."],
  ["range", "range(stop) or range(start, stop[, step])", "Return an immutable sequence of numbers."],
  ["int", "int(x=0, base=10) -> int", "Convert a number or string to an integer."],
  ["float", "float(x=0) -> float", "Convert a string or number to a floating-point number."],
  ["str", "str(object='') -> str", "Return a string version of an object."],
  ["list", "list(iterable=()) -> list", "Create a mutable list."],
  ["dict", "dict(**kwargs) -> dict", "Create a dictionary."],
  ["set", "set(iterable=()) -> set", "Create an unordered collection of unique values."],
  ["tuple", "tuple(iterable=()) -> tuple", "Create an immutable tuple."],
  ["bool", "bool(x) -> bool", "Convert a value to a Boolean."],
  ["sum", "sum(iterable, /, start=0)", "Return the sum of an iterable."],
  ["min", "min(iterable, *[, key, default])", "Return the smallest item."],
  ["max", "max(iterable, *[, key, default])", "Return the largest item."],
  ["sorted", "sorted(iterable, /, *, key=None, reverse=False)", "Return a new sorted list."],
  ["enumerate", "enumerate(iterable, start=0)", "Yield pairs containing a count and a value."],
  ["zip", "zip(*iterables, strict=False)", "Iterate over tuples made from multiple iterables."],
  ["map", "map(function, iterable, /, *iterables)", "Apply a function to every item."],
  ["filter", "filter(function_or_None, iterable)", "Keep items for which a function is true."],
  ["abs", "abs(x) -> number", "Return the absolute value."],
  ["round", "round(number, ndigits=None)", "Round a number to a given precision."],
  ["type", "type(object) or type(name, bases, dict)", "Return an object's type or create a class."],
  ["isinstance", "isinstance(obj, class_or_tuple) -> bool", "Check whether an object is an instance of a class."],
  ["issubclass", "issubclass(cls, class_or_tuple) -> bool", "Check whether a class derives from another class."],
  ["super", "super(type, object_or_type=None)", "Return a proxy object for parent class methods."],
  ["any", "any(iterable) -> bool", "Return true if any item is true."],
  ["all", "all(iterable) -> bool", "Return true if every item is true."],
  ["dir", "dir(object=None) -> list", "Return names in an object's namespace."],
  ["help", "help(request)", "Start the interactive help system."],
];

const PYTHON_SNIPPETS = [
  ["for loop", "for ${1:item} in ${2:iterable}:\n    ${0:pass}", "Loop over an iterable."],
  ["while loop", "while ${1:condition}:\n    ${0:pass}", "Repeat while a condition is true."],
  ["def function", "def ${1:function_name}(${2:params}):\n    ${0:pass}", "Define a Python function."],
  ["class", "class ${1:ClassName}:\n    def __init__(self, ${2:params}):\n        ${0:pass}", "Define a class with an initializer."],
  ["try...except", "try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:error}:\n    ${0:print(error)}", "Handle an exception."],
  ["with open", "with open(${1:'file.txt'}, ${2:'r'}, encoding='utf-8') as ${3:file}:\n    ${0:content = file.read()}", "Open a file using a context manager."],
  ["if __name__ == '__main__'", "if __name__ == \"__main__\":\n    ${0:main()}", "Standard Python entrypoint guard."],
  ["list comprehension", "[${1:item} for ${1:item} in ${2:iterable} if ${3:condition}]", "Build a list from an iterable."],
];

function itemRange(monaco: any, model: any, position: any) {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

function insertName(label: string): string {
  return label.replace(/\(.*$/, "");
}

function moduleNamesFromOpenFiles(currentFileName: string): string[] {
  return pythonWorkspaceFiles
    .filter((file) => file.name !== currentFileName)
    .map((file) => file.name.replace(/\.py$/, "").replace(/[^a-zA-Z0-9_]/g, "_"))
    .filter(Boolean);
}

function workspaceMembers(moduleName: string, currentFileName: string): Array<{ name: string; source: string }> {
  const file = pythonWorkspaceFiles.find((candidate) => {
    const module = candidate.name.replace(/\.py$/, "");
    return candidate.name !== currentFileName && (module === moduleName || candidate.path?.replace(/^\//, "").replace(/\.py$/, "") === moduleName);
  });
  if (!file) return [];

  const names = new Set<string>();
  for (const match of file.content.matchAll(/^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/gm)) {
    names.add(match[1]);
  }
  for (const match of file.content.matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*/gm)) {
    names.add(match[1]);
  }
  return [...names].map((name) => ({ name, source: file.name }));
}

function allWorkspaceDefinitions(currentFileName: string): Array<{ name: string; source: string }> {
  const definitions: Array<{ name: string; source: string }> = [];
  for (const file of pythonWorkspaceFiles) {
    if (file.name === currentFileName) continue;
    const names = new Set<string>();
    for (const match of file.content.matchAll(/^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/gm)) names.add(match[1]);
    for (const match of file.content.matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*/gm)) names.add(match[1]);
    for (const name of names) definitions.push({ name, source: file.name });
  }
  return definitions;
}

function importedAliases(code: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const match of code.matchAll(/^\s*import\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s+as\s+([A-Za-z_]\w*))?/gm)) {
    aliases[match[2] || match[1].split(".")[0]] = match[1];
  }
  return aliases;
}

function completionItemsForNames(monaco: any, names: string[], range: any, detail?: string) {
  return names.map((name) => ({
    label: name,
    insertText: insertName(name),
    filterText: insertName(name),
    kind: monaco.languages.CompletionItemKind.Method,
    detail,
    range,
  }));
}

function completionItemsForMembers(monaco: any, moduleName: string, range: any, currentFileName: string) {
  const members = MODULE_MEMBERS[moduleName] || [];
  const ownMembers = workspaceMembers(moduleName, currentFileName).map((member) => member.name);
  const names = [...new Set([...members, ...ownMembers])];
  return completionItemsForNames(monaco, names, range, `${moduleName} member`);
}

let jediDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const jediCache = new Map<string, Array<JediCompletion>>();

function jediKey(model: any, position: any) {
  return `${model.uri?.toString?.() || model.id}:${model.getVersionId?.() || 0}:${position.lineNumber}:${position.column}`;
}

function startJediCompletion(monaco: any, model: any, position: any, range: any) {
  if (jediDebounceTimer) clearTimeout(jediDebounceTimer);
  const key = jediKey(model, position);
  if (jediCache.has(key)) return;

  jediDebounceTimer = setTimeout(async () => {
    try {
      const results = await runJediCompletion(
        model.getValue(),
        position.lineNumber,
        Math.max(0, position.column - 1)
      );
      jediCache.set(key, results);

      // The first load happens in the background. Re-open the suggestions
      // widget once Jedi is ready so the user gets the richer results without
      // making the first tap wait for Pyodide + Jedi.
      const editor = monaco.editor
        ?.getEditors?.()
        ?.find((candidate: any) => candidate.getModel?.() === model);
      editor?.trigger("cursive-jedi", "editor.action.triggerSuggest", {});
    } catch {
      // Phase 1 suggestions remain available if the optional Jedi package is
      // not present in the selected Pyodide build or the code is incomplete.
    }
  }, 250);
}

function jediItems(monaco: any, results: JediCompletion[], range: any) {
  return results.map((result) => ({
    label: result.name,
    insertText: result.name,
    filterText: result.name,
    kind: monaco.languages.CompletionItemKind[result.type] || monaco.languages.CompletionItemKind.Text,
    detail: result.description,
    documentation: result.documentation,
    range,
  }));
}

/** Register each provider once per Monaco instance. */
export function registerLanguageProviders(monaco: any) {
  if (!monaco || (monaco as any).__codepadProvidersRegistered) return;
  (monaco as any).__codepadProvidersRegistered = true;

  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: ["."],
    provideCompletionItems: (model: any, position: any, context: any) => {
      const range = itemRange(monaco, model, position);
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const currentFileName = model.uri?.path?.split("/").pop() || "";
      const currentWord = model.getWordUntilPosition(position).word;
      const aliases = importedAliases(model.getValue());
      const suggestions: any[] = [];

      // `module.` member completion, including aliases such as `import math as m`.
      const memberMatch = linePrefix.match(/(?:^|[^\w.])([A-Za-z_]\w*)\.[A-Za-z_]\w*$/);
      if (memberMatch) {
        const typedModule = memberMatch[1];
        const moduleName = aliases[typedModule] || typedModule;
        suggestions.push(...completionItemsForMembers(monaco, moduleName, range, currentFileName));
      }

      // Module names after `import` or `from` are available even in an empty file.
      const fromModuleMatch = linePrefix.match(/^\s*from\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)?$/);
      const fromMemberMatch = linePrefix.match(/^\s*from\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+import\s+([A-Za-z_]\w*)?$/);
      const importMatch = linePrefix.match(/^\s*import\s+(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*,\s*)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)?$/);

      if (fromMemberMatch) {
        const moduleName = fromMemberMatch[1];
        suggestions.push(...completionItemsForMembers(monaco, moduleName, range, currentFileName));
      } else if (fromModuleMatch) {
        suggestions.push(...completionItemsForNames(monaco, PYTHON_STDLIB_MODULES, range, "Python 3.12 standard library"));
        suggestions.push(...completionItemsForNames(monaco, moduleNamesFromOpenFiles(currentFileName), range, "Open project file"));
      } else if (importMatch) {
        suggestions.push(...completionItemsForNames(monaco, PYTHON_STDLIB_MODULES, range, "Python 3.12 standard library"));
        suggestions.push(...completionItemsForNames(monaco, moduleNamesFromOpenFiles(currentFileName), range, "Open project file"));
      }

      // Names from other open Python files are useful both at the top level and
      // after a matching `utils.` module prefix.
      if (!memberMatch && !fromMemberMatch) {
        suggestions.push(
          ...allWorkspaceDefinitions(currentFileName).map(({ name, source }) => ({
            label: name,
            insertText: name,
            filterText: name,
            kind: monaco.languages.CompletionItemKind.Function,
            detail: `from ${source}`,
            range,
          }))
        );
      }

      const snippetItems = PYTHON_SNIPPETS.map(([label, insertText, documentation]) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation,
        range,
      }));
      const builtinItems = PYTHON_BUILTINS.map(({ name, signature, documentation }) => ({
        label: signature,
        filterText: name,
        insertText: `${name}($0)`,
        kind: monaco.languages.CompletionItemKind.Function,
        documentation,
        detail: "Python built-in",
        range,
      }));

      // Keep imports focused on modules; elsewhere show snippets, built-ins,
      // and definitions. This makes `import` useful on a small phone screen.
      if (!fromModuleMatch && !fromMemberMatch && !importMatch) {
        suggestions.push(...snippetItems, ...builtinItems);
      }

      const cachedJedi = jediCache.get(jediKey(model, position));
      const shouldWarmJedi = Boolean(linePrefix.includes(".") || context?.triggerKind === 0 || context?.triggerKind === 1);
      if (shouldWarmJedi) {
        startJediCompletion(monaco, model, position, range);
        if (cachedJedi) suggestions.push(...jediItems(monaco, cachedJedi, range));
      }

      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider("python", {
    provideHover: (model: any, position: any) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const hints: Record<string, string> = {
        print: "```python\nprint(*objects, sep=' ', end='\\n', file=None, flush=False)\n```\nPrint values to the console.",
        input: "```python\ninput(prompt='') -> str\n```\nRead a line of text from the user.",
        open: "```python\nopen(file, mode='r', encoding=None)\n```\nOpen a file relative to the project working directory.",
        len: "```python\nlen(s) -> int\n```\nReturn the number of items in a container.",
        range: "```python\nrange(stop) -> range object\nrange(start, stop[, step]) -> range object\n```\nReturn a sequence of numbers.",
        sum: "```python\nsum(iterable, /, start=0) -> number\n```\nReturn the sum of all elements in an iterable plus the start value.",
        map: "```python\nmap(func, *iterables) -> map object\n```\nMake an iterator that computes a function over iterables.",
        filter: "```python\nfilter(function_or_none, iterable) -> filter object\n```\nReturn items for which the function is true.",
      };
      if (!hints[word.word]) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: hints[word.word] }],
      };
    },
  });

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

  ["javascript", "typescript"].forEach((lang) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model: any, position: any) => ({
        suggestions: jsSnippets.map((snippet) => ({ ...snippet, range: itemRange(monaco, model, position) })),
      }),
    });
  });

  monaco.languages.registerCompletionItemProvider("html", {
    provideCompletionItems: (model: any, position: any) => {
      const range = itemRange(monaco, model, position);
      return {
        suggestions: [
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
            documentation: "Div with CSS class",
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
        ],
      };
    },
  });

  // Monaco's CSS worker still supplies native property/value suggestions. These
  // small snippets add the same quick patterns without replacing that worker.
  monaco.languages.registerCompletionItemProvider("css", {
    provideCompletionItems: (model: any, position: any) => {
      const range = itemRange(monaco, model, position);
      const snippets = [
        ["display: flex", "display: flex;\n  ${0}", "Flexbox layout"],
        ["box model", "box-sizing: border-box;\n  margin: ${1:0};\n  padding: ${0:0};", "Common box-model properties"],
        ["media query", "@media (max-width: ${1:768px}) {\n  ${0}\n}", "Responsive media query"],
        ["custom property", "--${1:name}: ${0:value};", "Define a CSS custom property"],
      ];
      return {
        suggestions: snippets.map(([label, insertText, documentation]) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation,
          range,
        })),
      };
    },
  });
}
