import { FileItem, Project } from "@/types";

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  language: string;
  files: Omit<FileItem, "id" | "projectId" | "createdAt" | "updatedAt">[];
}

export const STARTER_TEMPLATES: ProjectTemplate[] = [
  {
    id: "python-starter",
    name: "Python 3 Playground",
    description: "Ready-to-run Python script with math calculations and per-file notes",
    icon: "🐍",
    language: "python",
    files: [
      {
        name: "main.py",
        path: "/main.py",
        language: "python",
        isFolder: false,
        content: `# CodePad Python 3 Playground 🚀
import math
import time

def solve_quadratic(a: float, b: float, c: float):
    discriminant = b**2 - 4*a*c
    if discriminant < 0:
        return "No real roots"
    elif discriminant == 0:
        return f"One root: {-b / (2*a)}"
    else:
        root1 = (-b + math.sqrt(discriminant)) / (2*a)
        root2 = (-b - math.sqrt(discriminant)) / (2*a)
        return f"Two roots: {root1:.2f}, {root2:.2f}"

def benchmark_primes(limit=1000):
    start = time.time()
    primes = []
    for num in range(2, limit):
        if all(num % i != 0 for i in range(2, int(math.isqrt(num)) + 1)):
            primes.append(num)
    duration = (time.time() - start) * 1000
    return primes, duration

if __name__ == "__main__":
    print("=" * 40)
    print("  🚀 CodePad Python 3 Execution Demo")
    print("=" * 40)
    
    # 1. Quadratic Equation Demo
    print("\\n[1] Quadratic Formula:")
    print("Roots for 2x² + 5x - 3 = 0 ->", solve_quadratic(2, 5, -3))
    
    # 2. Prime Benchmark
    primes, ms = benchmark_primes(500)
    print(f"\\n[2] Primes under 500: found {len(primes)} primes in {ms:.2f}ms")
    print("First 10 primes:", primes[:10])
`,
        notes: `### 📌 Python Playground Notes
- **TODO**: Add Newton-Raphson solver function
- **Idea**: Plot prime distribution using ASCII chart
- **Complexity**: Prime trial division is O(N * sqrt(N))
`,
      },
      {
        name: "utils.py",
        path: "/utils.py",
        language: "python",
        isFolder: false,
        content: `def format_currency(amount: float) -> str:
    return f"\${amount:,.2f}"

def chunk_list(lst, chunk_size):
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]
`,
        notes: "Helper utilities for data formatting.",
      },
      {
        name: "README.md",
        path: "/README.md",
        language: "markdown",
        isFolder: false,
        content: `# Python 3 CodePad Workspace

Press the **Run** button (or Ctrl+Enter) to run \`main.py\` right in your browser (Pyodide)!

Use the **Notepad** panel on the right to keep separate notes for each file.
`,
        notes: "Project overview documentation.",
      },
    ],
  },
  {
    id: "web-starter",
    name: "Interactive Web App (HTML/CSS/JS)",
    description: "Responsive interactive web page with live preview in CodePad",
    icon: "🌐",
    language: "html",
    files: [
      {
        name: "index.html",
        path: "/index.html",
        language: "html",
        isFolder: false,
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodePad Dynamic Counter</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="card">
    <div class="badge">CodePad Live Preview</div>
    <h1>⚡ Interactive Counter</h1>
    <p class="subtitle">Edit files and click Run to test!</p>
    
    <div class="counter-display" id="count">0</div>
    
    <div class="btn-group">
      <button class="btn btn-danger" onclick="decrement()">-1</button>
      <button class="btn btn-secondary" onclick="reset()">Reset</button>
      <button class="btn btn-primary" onclick="increment()">+1</button>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
`,
        notes: "Main HTML layout with embedded interactive elements.",
      },
      {
        name: "style.css",
        path: "/style.css",
        language: "css",
        isFolder: false,
        content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: radial-gradient(circle at top, #1e293b, #0f172a);
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

.card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 32px;
  border-radius: 20px;
  text-align: center;
  max-width: 380px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}

.counter-display {
  font-size: 64px;
  font-weight: 800;
  margin: 24px 0;
  color: #38bdf8;
  font-variant-numeric: tabular-nums;
  transition: transform 0.15s ease;
}

.btn-group {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #ef4444; color: white; }
.btn-secondary { background: #475569; color: white; }
`,
        notes: "Modern dark-themed CSS styling with CSS glassmorphism.",
      },
      {
        name: "app.js",
        path: "/app.js",
        language: "javascript",
        isFolder: false,
        content: `let count = 0;
const display = document.getElementById('count');

function updateDisplay() {
  display.innerText = count;
  display.style.transform = 'scale(1.2)';
  setTimeout(() => display.style.transform = 'scale(1)', 150);
}

function increment() {
  count++;
  updateDisplay();
}

function decrement() {
  count--;
  updateDisplay();
}

function reset() {
  count = 0;
  updateDisplay();
}
`,
        notes: "DOM manipulation and counter state logic.",
      },
    ],
  },
  {
    id: "js-data-structures",
    name: "JavaScript & TypeScript Starter",
    description: "Modern JavaScript algorithm implementations and console experiments",
    icon: "⚡",
    language: "javascript",
    files: [
      {
        name: "algorithms.js",
        path: "/algorithms.js",
        language: "javascript",
        isFolder: false,
        content: `// Binary Search & Merge Sort in JavaScript

function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  let res = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] < right[j]) res.push(left[i++]);
    else res.push(right[j++]);
  }
  return [...res, ...left.slice(i), ...right.slice(j)];
}

// Test Runner
console.log("=== JavaScript Algorithms Demo ===");
const unsorted = [64, 34, 25, 12, 22, 11, 90, 5];
console.log("Unsorted Array:", unsorted);

const sorted = mergeSort(unsorted);
console.log("Sorted Array:  ", sorted);

const target = 22;
const idx = binarySearch(sorted, target);
console.log(\`Found \${target} at index: \${idx}\`);
`,
        notes: "Divide and conquer algorithms with logarithmic time complexity.",
      },
    ],
  },
  {
    id: "cpp-starter",
    name: "C++ (GCC) Environment",
    description: "Standard C++20 program with vector operations and standard library",
    icon: "⚙️",
    language: "cpp",
    files: [
      {
        name: "main.cpp",
        path: "/main.cpp",
        language: "cpp",
        isFolder: false,
        content: `#include <iostream>
#include <vector>
#include <algorithm>
#include <string>

struct Student {
    std::string name;
    double score;
};

int main() {
    std::cout << "🚀 CodePad C++ Compiler\\n";
    std::cout << "=========================\\n";
    
    std::vector<Student> students = {
        {"Alice", 94.5},
        {"Bob", 88.0},
        {"Charlie", 96.2},
        {"Diana", 91.0}
    };
    
    // Sort descending by score
    std::sort(students.begin(), students.end(), [](const Student& a, const Student& b) {
        return a.score > b.score;
    });
    
    std::cout << "Top Ranked Students:\\n";
    for (size_t i = 0; i < students.size(); ++i) {
        std::cout << (i + 1) << ". " << students[i].name << " -> " << students[i].score << "%\\n";
    }
    
    return 0;
}
`,
        notes: "C++ struct and lambda comparator demonstration.",
      },
    ],
  },
];
