"use client";

/**
 * AI conversation threads.
 *
 * A thread stores only the *task text* of each user turn — never the attached
 * project context. The freshest context (active file, selection, run output,
 * file list) is rebuilt and attached at send time, so old copies never pile up
 * in the history and the oldest turns can be trimmed to fit the context budget.
 *
 * The last few threads are kept in localStorage so a conversation survives
 * closing the AI panel and restarting the app, until the user starts a new
 * chat.
 */

import type { ChatMessage } from "./ai-connections";

export interface ChatTurn {
  role: "user" | "assistant";
  /** What is replayed to the model on later turns. */
  content: string;
  /** What the bubble shows; falls back to `content` when absent. */
  display?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: number;
  turns: ChatTurn[];
}

const THREADS_KEY = "cursive_ai_chat_threads";
const ACTIVE_KEY = "cursive_ai_active_chat";

/** How many recent chats are kept locally. */
export const MAX_SAVED_CHATS = 5;

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked */
  }
}

function removeLocal(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function makeThreadId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeTurns(raw: any): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t: any) =>
        t &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string"
    )
    .map((t: any) => ({
      role: t.role,
      content: t.content,
      ...(typeof t.display === "string" && t.display
        ? { display: t.display }
        : {}),
    }))
    .slice(0, 80);
}

function sanitizeThread(raw: any): ChatThread | null {
  if (!raw || typeof raw.id !== "string") return null;
  const turns = sanitizeTurns(raw.turns);
  if (turns.length === 0) return null;
  return {
    id: raw.id,
    title: typeof raw.title === "string" && raw.title ? raw.title : deriveTitle(turns),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    turns,
  };
}

/** All locally saved chats, newest first, capped at MAX_SAVED_CHATS. */
export function loadThreads(): ChatThread[] {
  const raw = readLocal(THREADS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const threads = parsed
      .map(sanitizeThread)
      .filter((t: ChatThread | null): t is ChatThread => t !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SAVED_CHATS);
    return threads;
  } catch {
    return [];
  }
}

/** Upsert a thread, keep it as the active one, and cap the saved list. */
export function saveThread(thread: ChatThread): void {
  const turns = sanitizeTurns(thread.turns);
  if (turns.length === 0) return;
  const entry: ChatThread = {
    id: thread.id,
    title: thread.title || deriveTitle(turns),
    updatedAt: thread.updatedAt || Date.now(),
    turns,
  };
  const list = loadThreads().filter((t) => t.id !== entry.id);
  list.push(entry);
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  writeLocal(THREADS_KEY, JSON.stringify(list.slice(0, MAX_SAVED_CHATS)));
  writeLocal(ACTIVE_KEY, entry.id);
}

/** Remove one saved chat (used by Clear). */
export function deleteThread(id: string): void {
  writeLocal(
    THREADS_KEY,
    JSON.stringify(loadThreads().filter((t) => t.id !== id))
  );
  if (readLocal(ACTIVE_KEY) === id) removeLocal(ACTIVE_KEY);
}

/** The conversation to restore when the AI panel opens. */
export function loadActiveThread(): ChatThread | null {
  const id = readLocal(ACTIVE_KEY);
  if (!id) return null;
  return loadThreads().find((t) => t.id === id) || null;
}

/** Short title from the first user message (its bubble text when available). */
export function deriveTitle(turns: ChatTurn[]): string {
  const first = turns.find((t) => t.role === "user");
  const text = (first?.display || first?.content || "New chat")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/**
 * Thread turns as chat messages. Empty replies become "(no reply)" so providers
 * that require non-empty, alternating messages (Anthropic) keep working.
 */
export function threadToMessages(turns: ChatTurn[]): ChatMessage[] {
  return turns.map((t) => ({
    role: t.role,
    content: t.content.trim() ? t.content : "(no reply)",
  }));
}

export interface ContentBlock {
  type: "text" | "code";
  content: string;
  /** Info string after the opening fence, e.g. "python". */
  lang?: string;
}

/**
 * Split an answer into prose and fenced code blocks so each block can offer
 * its own Copy / Insert actions. Unterminated fences (a streaming model that
 * stopped mid-block) are kept as a code block.
 */
export function parseFencedBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let prose: string[] = [];
  let code: string[] | null = null;
  let lang = "";

  const flushProse = () => {
    const chunk = prose.join("\n").trim();
    if (chunk) blocks.push({ type: "text", content: chunk });
    prose = [];
  };

  for (const line of text.split("\n")) {
    if (code === null) {
      const open = /^```([^`]*)$/.exec(line);
      if (open) {
        flushProse();
        lang = open[1].trim();
        code = [];
      } else {
        prose.push(line);
      }
    } else if (/^```[ \t]*$/.test(line)) {
      blocks.push({ type: "code", lang, content: code.join("\n") });
      code = null;
      lang = "";
    } else {
      code.push(line);
    }
  }

  if (code !== null) {
    // A fence the model never closed is still shown as code.
    blocks.push({ type: "code", lang, content: code.join("\n") });
  } else {
    flushProse();
  }

  if (blocks.length === 0) blocks.push({ type: "text", content: text });
  return blocks;
}
