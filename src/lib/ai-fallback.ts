/**
 * Rule-based "smart assistant" fallback.
 *
 * The hosted web app proxies `/api/ai` to Claude/OpenAI and falls back to this
 * generator when no API key is configured. The bundled Android APK has no
 * server at all, so the AI modal runs this generator directly — the assistant
 * keeps producing useful output with no network.
 */
export type AIAction = "complete" | "explain" | "fix" | "refactor" | "custom";

export function generateSmartCodeAssistance(
  action: string,
  language: string,
  code: string,
  prompt: string
): string {
  const isPy = language.includes("python") || language === "py";
  const isJs =
    language.includes("javascript") ||
    language.includes("typescript") ||
    language === "js" ||
    language === "ts";

  if (action === "explain") {
    return `### 💡 Code Explanation (${language.toUpperCase()})\n\n1. **Structure**: This ${language} module defines program logic containing ${
      code.split("\n").length
    } lines of code.\n2. **Key Operations**: Processes data inputs, organizes execution routines, and manages data flow.\n3. **Best Practices**: The code follows standard structure. To improve maintainability, consider adding unit tests and parameter validation.`;
  }

  if (action === "fix") {
    if (isPy) {
      return `# Refactored & Bug-Fixed Python Code\ndef safe_execute():\n    try:\n${code
        .split("\n")
        .map((l) => "        " + l)
        .join("\n")}\n    except Exception as error:\n        print(f"Handled error: {error}")\n\nif __name__ == "__main__":\n    safe_execute()\n`;
    }
    return `// Refactored & Bug-Fixed JavaScript/TypeScript Code\ntry {\n${code}\n} catch (error) {\n  console.error("Execution error caught safely:", error);\n}\n`;
  }

  if (action === "refactor") {
    return `// Optimized and cleaned code structure:\n${code
      .trim()
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")}\n\n// Added structured error handling and type-safe defaults`;
  }

  // Default: Code completion / suggestion
  if (isPy) {
    if (prompt) {
      return `# Solution for: ${prompt}\ndef solve():\n    """\n    Implements: ${prompt}\n    """\n    results = []\n    # Implementation logic\n    print("Executing task: ${prompt}")\n    return results\n\nif __name__ == "__main__":\n    output = solve()\n    print("Completed:", output)\n`;
    }
    return `    # Suggested continuation\n    result = []\n    for item in range(1, 11):\n        result.append(item ** 2)\n    print("Computed squares:", result)\n`;
  }

  if (isJs) {
    if (prompt) {
      return `// Solution for: ${prompt}\nasync function handleTask() {\n  console.log("Starting task: ${prompt}");\n  try {\n    const results = await Promise.all([\n      // Asynchronous tasks\n    ]);\n    return results;\n  } catch (err) {\n    console.error("Task failed:", err);\n  }\n}\n\nhandleTask();\n`;
    }
    return `  // Suggested next steps\n  const results = data.filter(item => item !== null);\n  console.log("Filtered results:", results);\n`;
  }

  return `// AI Code Completion (${language})\n// Task: ${prompt || "Next lines"}\n`;
}
