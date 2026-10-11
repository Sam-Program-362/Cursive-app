# Cursive — A Mobile-Friendly Code Editor

**Cursive is a code editor project built with a simple goal: make writing and experimenting with code more practical on a phone, while also supporting a desktop-style development workflow.**

The project includes a responsive web editor and an Android APK. Its feature set brings together code editing, file management, browser-based execution for selected languages, project export, and optional integrations such as GitHub and AI coding assistance.

> **Project status:** Cursive is an ongoing independent project. Features and setup paths may have different levels of maturity; please check the source code and release notes for the current state. The project has not been independently audited or security-reviewed.

## Contents

- [Project overview](#project-overview)
- [Why Cursive exists](#why-cursive-exists)
- [Features](#features)
- [Web version and Android version](#web-version-and-android-version)
- [Technology stack](#technology-stack)
- [Try the project](#try-the-project)
- [Run the web app locally](#run-the-web-app-locally)
- [Environment variables](#environment-variables)
- [Android APK](#android-apk)
- [Project structure and development](#project-structure-and-development)
- [Security and limitations](#security-and-limitations)
- [Contributing and feedback](#contributing-and-feedback)
- [About the project](#about-the-project)
- [License](#license)

## Project overview

Cursive is designed around the idea that a code editor should remain useful even when the person using it does not have a traditional desktop setup. The interface is mobile-friendly, and the project explores ways to bring common coding tasks—editing files, switching between tabs, running code, and exporting work—into one place.

The repository contains the application source code and related build configuration. You can inspect the implementation, review the project's progress, or use the setup instructions below to explore the web application.

- **Repository:** [Sam-Program-362/Cursive-app](https://github.com/Sam-Program-362/Cursive-app)
- **Releases and Android APK:** [View GitHub releases](https://github.com/Sam-Program-362/Cursive-app/releases)
- **Issues and feedback:** [Report a bug or suggest an improvement](https://github.com/Sam-Program-362/Cursive-app/issues)

## Why Cursive exists

Cursive is an independent learning and development project focused on making software development more accessible on mobile devices. It is also a way to learn by building: connecting a user interface, editor tooling, code execution, data storage, and integrations in a single application.

The aim is not to claim that a phone replaces every full development computer. Instead, Cursive explores how much of a practical coding workflow can be made accessible from a mobile-first interface, while documenting the technologies and trade-offs involved.

## Features

The repository README describes the following features. Availability and behaviour can vary by version, so consult the current source and release notes if you need to rely on a particular feature.

### Editing and file management

- **Mobile-first editor interface** using Monaco Editor.
- **File tree** with nested folders.
- **Multi-tab editing** for working across files.
- **IntelliSense and code snippets** where supported.
- **Quick-key row** intended to make common coding characters easier to enter on a phone.
- **Themes and editor customization**, including font controls and a theme builder.
- **Per-file notes** for keeping short reminders alongside code.

### Running and previewing code

- **Python in the browser** using Pyodide/WebAssembly.
- **JavaScript execution** in a sandboxed iframe.
- **HTML/CSS/JavaScript live preview** for front-end experiments.
- **Standard input support** for interactive Python programs where supported.
- **Execution timeout** intended to stop code that runs too long.

Browser-based execution has technical and security limitations. It is not the same as a full operating-system terminal or a general-purpose server environment.

### Saving, exporting, and integrations

- **Local persistence** using browser storage.
- **Optional database sync** through Neon PostgreSQL.
- **GitHub integration** for pushing and pulling files, when configured.
- **ZIP export** for taking project files elsewhere.
- **Optional AI coding assistant** using a supported Claude or OpenAI integration, when configured.

Some integrations require API credentials, environment variables, network access, or a configured database. They should not be assumed to work automatically in a fresh installation.

## Web version and Android version

Cursive has a web application and an Android APK build.

| Version | Intended use | Notes |
|---|---|---|
| Web app | Edit and experiment with code through a browser | Some features depend on environment configuration and browser support. |
| Android APK | Use the editor through an Android application | The repository README describes an embedded editor and native CPython support through Chaquopy. Check the relevant release notes for version-specific details. |

The Android build is intended to make coding more practical on a phone. According to the repository documentation, the APK includes native CPython support through Chaquopy for Python features such as `input()`, file access, and imports. Actual compatibility can depend on the APK version, Android device, and installed build.

**You do not need to install the APK to review this project.** You can inspect the source code, workflow files, documentation, and release history directly on GitHub. Only install an APK if you choose to and trust the source.

## Technology stack

The project documentation lists these main technologies:

- **Next.js 14** — application framework and routing.
- **Monaco Editor** — code-editing interface.
- **Tailwind CSS** — styling.
- **Neon PostgreSQL and Drizzle ORM** — database and data access.
- **Pyodide / WebAssembly** — Python execution in the browser.
- **Sandboxed iframe** — JavaScript execution and front-end preview.
- **JSZip** — ZIP export.
- **Chaquopy** — native Python support in the Android build, as described in the project documentation.

These technologies are included to show how the project is assembled; they are not a claim that every integration is enabled in every deployment.

## Try the project

### Review it without installing anything

1. Open the [GitHub repository](https://github.com/Sam-Program-362/Cursive-app).
2. Read the source and documentation.
3. Open [Releases](https://github.com/Sam-Program-362/Cursive-app/releases) to see available Android builds and release notes.
4. Review the GitHub Actions workflows to understand how builds are produced.

### Use a published web deployment

If a current public web deployment is linked in the repository's About section or project documentation, use that link. A deployment may not be available at all times, and features requiring private credentials may be unavailable in a public demo.

### Download the Android APK

If you want to try the Android version, open the [Releases page](https://github.com/Sam-Program-362/Cursive-app/releases) and read the release notes before downloading. Android may display a warning when installing an APK outside the Play Store. Do not install software unless you are comfortable with its source and permissions.

## Run the web app locally

These are the general steps for a Next.js project. Follow the repository's current configuration if it differs.

### Requirements

- Node.js and npm versions compatible with the project's dependencies.
- Git, if you want to clone the repository.
- Any external services you intend to use, such as a Neon database or an AI provider API key.

### Setup

```bash
git clone https://github.com/Sam-Program-362/Cursive-app.git
cd Cursive-app
npm install
```

Create a local environment file named `.env.local` in the project root and add the environment variables required by the features you want to use. See [Environment variables](#environment-variables).

Start the development server:

```bash
npm run dev
```

Open the local address printed by Next.js in your terminal, usually `http://localhost:3000`.

Build the application for production:

```bash
npm run build
```

Do not commit `.env.local` or any file containing API keys, database credentials, tokens, or other secrets.

## Environment variables

The exact required variables depend on the current implementation and the features you enable. Check the code and deployment settings for the authoritative list before configuring the app.

Typical categories may include:

- Neon/PostgreSQL database connection settings.
- GitHub integration credentials or tokens.
- AI provider API keys for the optional coding assistant.

**Never put private API keys or database credentials in client-side code or commit them to a public repository.** Use server-side environment variables and the relevant provider's security guidance. If a variable is not required for the feature you are testing, leave that integration unconfigured rather than inserting placeholder secrets.

## Android APK

The repository includes Android build instructions and automation. According to the project documentation, pushes to the `main` branch trigger a GitHub Actions workflow that builds the APK.

For the exact current build process, inspect the repository's Android-related files and workflow configuration. Build commands and requirements can change as dependencies are updated.

If you install a newer APK over an earlier one, follow the release notes and Android's installation prompts. Back up important projects before upgrading; do not assume every version preserves all local data.

## Project structure and development

This is an application repository, not just a mock-up or a design concept. It includes application code, editor and execution features, integrations, and build configuration. The most reliable way to understand the current implementation is to explore the source code and recent commits.

Useful places to review:

- [`app/` and related application source](https://github.com/Sam-Program-362/Cursive-app)
- [`public/` assets and browser-facing files](https://github.com/Sam-Program-362/Cursive-app/tree/main/public)
- [GitHub Actions workflows](https://github.com/Sam-Program-362/Cursive-app/tree/main/.github/workflows)
- [Commit history](https://github.com/Sam-Program-362/Cursive-app/commits/main)
- [Open issues](https://github.com/Sam-Program-362/Cursive-app/issues)

Repository paths and workflow names may change over time. If a link does not point to the expected file, browse the repository tree.

## Security and limitations

Cursive is an independent project and should be evaluated with the same care as other software obtained from an unfamiliar source.

- **Review before running:** inspect the code and release notes before using the application.
- **Treat code execution carefully:** code you write or import can have unintended effects. Browser sandboxing has limits, and native Python execution has different permissions from browser execution.
- **Protect credentials:** do not place secrets in public files, client-side bundles, screenshots, or issue reports.
- **Database and third-party services:** optional integrations may send data to external providers when configured. Review their behaviour before storing sensitive information.
- **Development status:** features may be incomplete, experimental, or version-dependent. Report problems with steps to reproduce them.

Cursive is intended as a learning and coding tool. It is not presented as a security-hardened environment for running untrusted code or handling sensitive production workloads.

## Contributing and feedback

Feedback is useful, especially when it includes enough detail to reproduce a problem.

When reporting a bug, include:

1. The version you are using (web deployment or APK release).
2. Your device, operating system, and browser, where relevant.
3. The steps you followed.
4. What you expected to happen and what actually happened.
5. Error messages or screenshots, after removing private information.

Use [GitHub Issues](https://github.com/Sam-Program-362/Cursive-app/issues) for bugs and feature requests. If you want to contribute code, open an issue first for substantial changes so the proposed approach can be discussed.

## About the project

Cursive is being developed as an independent software project by **Sam-Program-362**. It reflects an ongoing effort to learn software development by building a real application, exploring mobile-first tooling, and connecting multiple parts of a modern web and Android stack.

If you are a developer, you can explore the source and provide technical feedback. If you represent a company, education programme, nonprofit, or potential supporter, the repository and release history provide a way to review the work without installing the application. Support, mentorship, code review, hardware access, or a referral to a relevant programme could all help the project and its developer progress.

Please evaluate the project based on the code and evidence available in the repository. No claim is made here that every listed feature has been independently tested on every device or deployment.

## License

Check the repository for the current license before copying, modifying, or redistributing the project. If no license file is present, do not assume that the code is licensed for unrestricted reuse.
