import { NextRequest, NextResponse } from "next/server";
import { generateSmartCodeAssistance } from "@/lib/ai-fallback";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      code,
      language,
      action = "complete",
      cursorPosition,
    } = await req.json();

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // If Claude API key is provided, use Anthropic Messages API
    if (anthropicKey) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            system:
              "You are an expert programming assistant in Cursive code editor. Provide clean, precise, and immediately useful code completions or answers. When asked for code, return ONLY the code or concise explanation.",
            messages: [
              {
                role: "user",
                content: buildAIPrompt(action, language, code, prompt),
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.content?.[0]?.text || "";
          return NextResponse.json({
            result: reply,
            engine: "claude-3-5-sonnet",
          });
        }
      } catch (err) {
        console.warn("Claude API call failed:", err);
      }
    }

    // If OpenAI API key is provided, use OpenAI Chat Completions
    if (openAiKey) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful coding assistant in Cursive editor. Provide concise, clean, working code snippets or explanations.",
                },
                {
                  role: "user",
                  content: buildAIPrompt(action, language, code, prompt),
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const reply = data.choices?.[0]?.message?.content || "";
          return NextResponse.json({
            result: reply,
            engine: "gpt-4o-mini",
          });
        }
      } catch (err) {
        console.warn("OpenAI API call failed:", err);
      }
    }

    // Built-in intelligent Cursive Assistant (works without requiring API keys)
    const fallbackResult = generateSmartCodeAssistance(
      action,
      language || "python",
      code || "",
      prompt || ""
    );

    return NextResponse.json({
      result: fallbackResult,
      engine: "codepad-smart-engine",
    });
  } catch (error: any) {
    console.error("AI assistant error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process AI request" },
      { status: 500 }
    );
  }
}

function buildAIPrompt(
  action: string,
  language: string,
  code: string,
  prompt?: string
): string {
  switch (action) {
    case "complete":
      return `Language: ${language}\n\nContext code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nTask: ${
        prompt || "Suggest the next logical lines of code to continue the snippet."
      }`;
    case "explain":
      return `Language: ${language}\n\nCode to explain:\n\`\`\`${language}\n${code}\n\`\`\`\n\nExplain clearly what this code does, step by step, and note any edge cases or performance characteristics.`;
    case "fix":
      return `Language: ${language}\n\nCode with potential bugs or issues:\n\`\`\`${language}\n${code}\n\`\`\`\n\nTask: Identify and fix any syntax errors, logical bugs, or performance issues. Provide the corrected code with brief comments.`;
    case "refactor":
      return `Language: ${language}\n\nCode to refactor:\n\`\`\`${language}\n${code}\n\`\`\`\n\nTask: Refactor this code for maximum readability, modern idiomatic standards, and best practices.`;
    case "custom":
    default:
      return `Language: ${language}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nRequest: ${prompt}`;
  }
}
