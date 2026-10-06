/**
 * Tests for AI conversation threads: saved-chat persistence, fenced-code
 * parsing, and the message list assembled for a follow-up or a continuation.
 *
 *   bun scripts/test-ai-chat.mjs
 */

import {
  MAX_SAVED_CHATS,
  deleteThread,
  deriveTitle,
  loadActiveThread,
  loadThreads,
  parseFencedBlocks,
  saveThread,
  threadToMessages,
} from "../src/lib/ai-chat";
import { CONTINUE_PROMPT, buildThreadMessages, turnTask } from "../src/lib/ai-client";

let failures = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    ok
      ? `PASS  ${name}`
      : `FAIL  ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`
  );
}

/* A tiny in-memory localStorage so persistence can be exercised headlessly. */
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const turn = (role, content) => ({ role, content });

/* Titles come from the first user message and are shortened. */
check(
  "title from first user message",
  deriveTitle([turn("user", "Explain the parser"), turn("assistant", "Sure")]),
  "Explain the parser"
);
check(
  "empty thread gets a default title",
  deriveTitle([turn("assistant", "hi")]),
  "New chat"
);
{
  const long = "x".repeat(80);
  const title = deriveTitle([turn("user", long)]);
  check("long title is truncated", title.length, 41);
  check("truncated title ends with an ellipsis", title.endsWith("…"), true);
}

/* Empty replies must be replaced so alternating-role providers keep working. */
check(
  "empty assistant replies become (no reply)",
  threadToMessages([turn("user", "hi"), turn("assistant", "   ")]),
  [
    { role: "user", content: "hi" },
    { role: "assistant", content: "(no reply)" },
  ]
);

/* Fenced code blocks are split out with their language. */
{
  const blocks = parseFencedBlocks(
    "Here you go:\n```python\nprint(1)\n```\nThat is all."
  );
  check("prose/code/prose is split into three blocks", blocks.length, 3);
  check("first block is prose", blocks[0].type, "text");
  check("code block keeps its language", blocks[1].lang, "python");
  check("code block content is unwrapped", blocks[1].content, "print(1)");
  check("trailing prose is kept", blocks[2].content, "That is all.");
}
{
  const single = parseFencedBlocks("```js\nconst a = 1;\n```");
  check("a lone code block has no prose", single.length, 1);
  check("lone block is code", single[0].type, "code");
  check("lone block language", single[0].lang, "js");
}
check(
  "plain prose stays one text block",
  parseFencedBlocks("Just words.").map((b) => b.type),
  ["text"]
);
{
  const unterminated = parseFencedBlocks("Sure:\n```py\nprint(1)");
  check("unterminated fence is kept as a code block", unterminated[1]?.type, "code");
  check("unterminated code is preserved", unterminated[1]?.content, "print(1)");
}

/* Threads persist, newest first, and the active chat is remembered. */
{
  saveThread({
    id: "c1",
    title: "First",
    updatedAt: 1000,
    turns: [turn("user", "one"), turn("assistant", "1")],
  });
  saveThread({
    id: "c2",
    title: "Second",
    updatedAt: 2000,
    turns: [turn("user", "two"), turn("assistant", "2")],
  });
  check("both chats are saved", loadThreads().length, 2);
  check("newest chat is first", loadThreads()[0].id, "c2");
  check("active chat is the last saved", loadActiveThread()?.id, "c2");

  saveThread({
    id: "c1",
    title: "First",
    updatedAt: 3000,
    turns: [turn("user", "one"), turn("assistant", "1")],
  });
  check("re-saving moves a chat to the top", loadThreads()[0].id, "c1");
  check("re-saving does not duplicate", loadThreads().length, 2);

  deleteThread("c1");
  check("delete removes the chat", loadThreads().some((t) => t.id === "c1"), false);
  check("deleting the active chat clears it", loadActiveThread(), null);
}
{
  /* The saved list is capped at MAX_SAVED_CHATS, keeping the newest. */
  for (let i = 0; i < MAX_SAVED_CHATS + 3; i += 1) {
    saveThread({
      id: `cap${i}`,
      title: `Chat ${i}`,
      updatedAt: 10000 + i,
      turns: [turn("user", `q${i}`), turn("assistant", `a${i}`)],
    });
  }
  const saved = loadThreads();
  check("saved chats are capped", saved.length, MAX_SAVED_CHATS);
  check("the newest chat survives the cap", saved[0].id, `cap${MAX_SAVED_CHATS + 2}`);
}
/* Corrupt storage must not throw. */
{
  store.set("cursive_ai_chat_threads", "{not json");
  check("corrupt storage yields no chats", loadThreads(), []);
  store.delete("cursive_ai_chat_threads");
}

/* A turn keeps its bubble text separate from what the model replays. */
{
  saveThread({
    id: "disp",
    title: "",
    updatedAt: 4000,
    turns: [
      { role: "user", content: "Language: python\n\nCode:\n```\nprint(1)\n```", display: "Explain this code" },
      { role: "assistant", content: "It prints 1." },
    ],
  });
  const restored = loadThreads().find((t) => t.id === "disp");
  check("bubble text survives a round trip", restored.turns[0].display, "Explain this code");
  check(
    "the model still replays the full turn",
    restored.turns[0].content.includes("print(1)"),
    true
  );
  check(
    "the title uses the bubble text",
    restored.title,
    "Explain this code"
  );
  check(
    "replayed messages never carry the bubble text",
    threadToMessages(restored.turns)[0].content.includes("Explain this code"),
    false
  );
  deleteThread("disp");
}

/* buildThreadMessages: history, first turn, and continuation. */
{
  const first = buildThreadMessages({
    systemPrompt: "SYS",
    userContent: "Q1",
  });
  check("first turn is system + user", first, [
    { role: "system", content: "SYS" },
    { role: "user", content: "Q1" },
  ]);
}
{
  const followUp = buildThreadMessages({
    systemPrompt: "SYS",
    history: [turn("user", "Q1"), turn("assistant", "A1")],
    userContent: "Q2",
  });
  check("follow-up appends after the history", followUp, [
    { role: "system", content: "SYS" },
    { role: "user", content: "Q1" },
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2" },
  ]);
}
{
  const cont = buildThreadMessages({
    systemPrompt: "SYS",
    history: [turn("user", "Q1"), turn("assistant", "partial answer")],
    userContent: "ignored",
    continueFrom: "partial answer",
  });
  check("continuation does not duplicate the partial answer", cont, [
    { role: "system", content: "SYS" },
    { role: "user", content: "Q1" },
    { role: "assistant", content: "partial answer" },
    { role: "user", content: CONTINUE_PROMPT },
  ]);
  check(
    "the continuation question is never repeated",
    cont.some((m) => m.content === "ignored"),
    false
  );
}
{
  /* One-shot continue (no saved thread): replay the question before asking. */
  const cont = buildThreadMessages({
    systemPrompt: "SYS",
    userContent: "original question",
    continueFrom: "half an answer",
  });
  check("one-shot continuation replays the question", cont, [
    { role: "system", content: "SYS" },
    { role: "user", content: "original question" },
    { role: "assistant", content: "half an answer" },
    { role: "user", content: CONTINUE_PROMPT },
  ]);
}

/* turnTask: with context it is just the instruction; without, it carries code. */
{
  const withContext = turnTask("explain", "python", "print(1)", "", true);
  check("task with context omits the code", withContext.includes("print(1)"), false);
  check(
    "task with context keeps the instruction",
    withContext.startsWith("Explain clearly what this code does"),
    true
  );
  const withoutContext = turnTask("explain", "python", "print(1)", "", false);
  check("task without context carries the code", withoutContext.includes("print(1)"), true);
}

console.log(
  failures === 0
    ? "\nALL AI CHAT TESTS PASSED"
    : `\n${failures} AI CHAT TEST(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
