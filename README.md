# 🚀 CodePad — Mobile-Friendly Web Code Editor

**CodePad** is a responsive, browser-based code editor web app built with Next.js (App Router), Monaco Editor, Neon PostgreSQL (Drizzle ORM), GitHub Integration, and in-browser Code Execution.

---

## ✨ Features Built

1. **Editor Shell (Mobile-First)**
   - Monaco Editor embedded with full touch & responsive layouts
   - File tree sidebar with nested folders, file creation, renaming, and deletion
   - Multi-tab file manager with dirty (unsaved) indicators and close actions

2. **Smart Autocomplete & IntelliSense ("Replit-Style")**
   - Monaco IntelliSense widget enabled with parameter hints & hover tooltips
   - Language-aware snippets for Python, JavaScript, TypeScript, HTML, CSS, C++, Rust
   - Opt-in **AI Coding Assistant** (`/api/ai`) with Claude/OpenAI integration for code completions, bug fixing, explanations, and refactoring on demand

3. **Smart Indentation & Quick-Key Bar**
   - Monaco `autoIndent: "full"` configuration
   - Auto-continuation of indentation on Enter, auto-increase after `{`, `:`, `(`
   - Mobile Quick Key row with single-tap brackets `{}`, `()`, `[]`, quotes `""`, `''`, operators, indentation controls, undo/redo

4. **Customizable Theming & Typography (Pydroid-Style)**
   - 9 built-in themes: VS Dark, VS Light, Dracula, One Dark Pro, Monokai, Nord, GitHub Dark, GitHub Light, High Contrast
   - **Custom Theme Builder**: Live color pickers for background, editor, sidebar, accent, and text colors
   - Font size adjuster (11px–26px) & font family selector (Fira Code, JetBrains Mono, Cascadia Code, Menlo, etc.)
   - User preferences persisted in Neon DB & localStorage

5. **Smooth Typing & UI Animations**
   - Smooth cursor blink (`cursorBlinking: "smooth"`) and smooth caret animations (`cursorSmoothCaretAnimation: "on"`)
   - Fast CSS transitions (150–200ms) for silky mobile performance

6. **Per-File Notepad**
   - Collapsible scratchpad panel tied to each open file
   - Persisted automatically via debounced auto-save to Neon DB
   - Markdown preview toggle, Todo checklist generator, and character counter

7. **Save & Sync**
   - Automatic debounced background saving to Neon DB & localStorage
   - **Push to GitHub**: Commit & push workspace files directly to GitHub repositories
   - **Pull from GitHub**: Import public or private repository trees into CodePad
   - **Export as ZIP**: One-click download of the entire workspace

8. **Code Execution (In-Browser Runner)**
   - **Run** button executes code entirely on your own device — no server, no API keys, no rate limits
   - **Python 3** runs via [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly), lazily loaded from the CDN on your first Run
   - **JavaScript** runs natively inside a sandboxed `<iframe>`; `console.log` output is piped back to the console
   - Both runtimes enforce a 10-second hard timeout so runaway loops can't freeze the tab
   - Other languages (TypeScript, C, C++, Rust) are listed as *coming soon* until they have a browser runtime
   - Bottom Console Panel with stdout, stderr, execution time, and exit status
   - **Web Live Preview**: In-browser sandboxed iframe for HTML/CSS/JS web projects
   - Interactive Stdin input stream

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + Lucide Icons
- **Execution**: In-browser — Pyodide (WebAssembly Python) + sandboxed iframe for JavaScript
- **Exporting**: JSZip

---

## 🚀 Environment Setup & Vercel Deployment

Create a `.env.local` file or configure these environment variables in your Vercel Project Settings:

```env
# Neon PostgreSQL Database URL
DATABASE_URL=postgresql://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# Optional: GitHub Access Token for automated Git push/pull
GITHUB_TOKEN=ghp_your_github_token

# Optional: Claude / OpenAI API Key for AI Assistant
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

### Running Locally

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open CodePad.
