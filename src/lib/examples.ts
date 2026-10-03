/**
 * Two small libraries used by the editor UI:
 *
 *  - NEW_FILE_TEMPLATES: short starter snippets a user can *optionally* pick
 *    when creating a file ("New from template"). A brand-new file is blank by
 *    default; these are only used when the user explicitly chooses one.
 *  - EXAMPLE_PROGRAMS: ready-made sample programs shown in a separate,
 *    read-only "Examples" section so learners always have something to run
 *    without it being mixed into their own files.
 *
 * Nothing here is inserted automatically.
 */

export interface NewFileTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  fileName: string;
  language: string;
  content: string;
}

export const NEW_FILE_TEMPLATES: NewFileTemplate[] = [
  {
    id: "python-hello",
    name: "Hello World",
    description: "The classic first program",
    icon: "👋",
    fileName: "hello.py",
    language: "python",
    content: `print("Hello, world!")\n`,
  },
  {
    id: "python-input",
    name: "Ask for input",
    description: "Read a name with input() and greet it",
    icon: "💬",
    fileName: "input_menu.py",
    language: "python",
    content: `name = input("What is your name? ")\nprint(f"Hello, {name}!")\n\nage = input("How old are you? ")\nprint(f"In 10 years you will be {int(age) + 10} years old.")\n`,
  },
  {
    id: "python-menu",
    name: "Simple menu loop",
    description: "A while-loop menu that keeps running until you quit",
    icon: "🔁",
    fileName: "menu.py",
    language: "python",
    content: `def main():\n    while True:\n        print("\\n1) Say hello")\n        print("2) Add two numbers")\n        print("3) Quit")\n        choice = input("Choose an option: ").strip()\n\n        if choice == "1":\n            print("Hello there!")\n        elif choice == "2":\n            a = float(input("First number: "))\n            b = float(input("Second number: "))\n            print("Sum:", a + b)\n        elif choice == "3":\n            print("Bye!")\n            break\n        else:\n            print("Please pick 1, 2 or 3.")\n\n\nif __name__ == "__main__":\n    main()\n`,
  },
  {
    id: "javascript-hello",
    name: "JavaScript console",
    description: "Log a message and loop over an array",
    icon: "⚡",
    fileName: "main.js",
    language: "javascript",
    content: `console.log("Hello, world!");\n\nconst fruits = ["apple", "banana", "cherry"];\nfor (const fruit of fruits) {\n  console.log("I like", fruit);\n}\n`,
  },
  {
    id: "html-page",
    name: "Basic web page",
    description: "A tiny HTML page you can preview",
    icon: "🌐",
    fileName: "index.html",
    language: "html",
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>My page</title>\n</head>\n<body>\n  <h1>Hello from Cursive</h1>\n  <p>Edit this file and press Run to preview it.</p>\n</body>\n</html>\n`,
  },
];

export interface ExampleProgram {
  id: string;
  name: string;
  description: string;
  language: string;
  content: string;
}

/** Read-only sample programs. Keep these small and self-contained. */
export const EXAMPLE_PROGRAMS: ExampleProgram[] = [
  {
    id: "fizzbuzz",
    name: "fizzbuzz.py",
    description: "The classic FizzBuzz loop",
    language: "python",
    content: `for n in range(1, 21):\n    if n % 15 == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print(n)\n`,
  },
  {
    id: "fibonacci",
    name: "fibonacci.py",
    description: "Print the first Fibonacci numbers",
    language: "python",
    content: `def fibonacci(count):\n    a, b = 0, 1\n    for _ in range(count):\n        yield a\n        a, b = b, a + b\n\n\nfor value in fibonacci(12):\n    print(value)\n`,
  },
  {
    id: "guess-game",
    name: "guess_the_number.py",
    description: "A small input() guessing game",
    language: "python",
    content: `import random\n\nsecret = random.randint(1, 20)\nprint("I am thinking of a number between 1 and 20.")\n\nwhile True:\n    guess = int(input("Your guess: "))\n    if guess < secret:\n        print("Too low!")\n    elif guess > secret:\n        print("Too high!")\n    else:\n        print("Correct! 🎉")\n        break\n`,
  },
  {
    id: "word-count",
    name: "word_count.py",
    description: "Count words in a sentence (dictionaries)",
    language: "python",
    content: `sentence = "the quick brown fox jumps over the lazy dog the fox"\ncounts = {}\n\nfor word in sentence.split():\n    counts[word] = counts.get(word, 0) + 1\n\nfor word, count in sorted(counts.items()):\n    print(f"{word:>6}: {count}")\n`,
  },
  {
    id: "js-arrays",
    name: "arrays.js",
    description: "Map, filter and reduce in JavaScript",
    language: "javascript",
    content: `const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\n\nconst evens = numbers.filter((n) => n % 2 === 0);\nconst doubled = numbers.map((n) => n * 2);\nconst total = numbers.reduce((sum, n) => sum + n, 0);\n\nconsole.log("Evens:", evens);\nconsole.log("Doubled:", doubled);\nconsole.log("Total:", total);\n`,
  },
  {
    id: "html-card",
    name: "card.html",
    description: "A styled card with a button (preview)",
    language: "html",
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Example card</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; }\n    .card { background: #1e293b; border-radius: 16px; padding: 28px; text-align: center; max-width: 320px; }\n    button { background: #38bdf8; border: none; color: #0f172a; font-weight: 700; padding: 10px 18px; border-radius: 10px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h2>Cursive Examples</h2>\n    <p>This page lives in the read-only Examples list.</p>\n    <button onclick="alert('Hello!')">Tap me</button>\n  </div>\n</body>\n</html>\n`,
  },
];
