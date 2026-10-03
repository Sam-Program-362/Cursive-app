"use client";

/**
 * Direct GitHub REST client used by the Android app and the web build.
 *
 * The old code called this app's own `/api/github` route with a relative
 * fetch. Inside the APK there is no server, so that request came back as the
 * app's HTML shell and `res.json()` threw
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Here we talk to
 * `api.github.com` ourselves instead:
 *
 *  - on device the request goes through Capacitor's native HTTP bridge
 *    (`CapacitorHttp`), which is not subject to WebView CORS rules;
 *  - on the web it is a normal fetch (GitHub allows cross-origin requests).
 *
 * Every failure is turned into a plain-language `GitHubError` carrying the
 * HTTP status and GitHub's own message, so the UI never shows a JSON parse
 * error.
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";

export interface GitHubUser {
  login: string;
  name?: string | null;
  avatar_url?: string;
}

export interface GitHubRepoInfo {
  full_name: string;
  name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
  description?: string | null;
}

export interface GitHubPulledFile {
  path: string;
  name: string;
  content: string;
}

export interface GitHubPushedFile {
  path: string;
  content: string;
}

export class GitHubError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Low-level request                                                   */
/* ------------------------------------------------------------------ */

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  token?: string;
  body?: unknown;
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function rawRequest(
  url: string,
  options: RequestOptions
): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const method = options.method ?? "GET";

  if (isNative()) {
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: options.body,
      responseType: "text",
    });
    return {
      status: response.status,
      text:
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data ?? ""),
    };
  }

  const bodyText = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  if (bodyText !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, { method, headers, body: bodyText });
  return { status: response.status, text: await response.text() };
}

async function apiJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  let status = 0;
  let text = "";
  try {
    const res = await rawRequest(url, options);
    status = res.status;
    text = res.text;
  } catch {
    throw new GitHubError(
      0,
      "Couldn't reach GitHub. Check that you're online and try again."
    );
  }

  let parsed: any;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (status >= 200 && status < 300) {
    return parsed as T;
  }

  throw new GitHubError(status, friendlyMessage(status, parsed));
}

function friendlyMessage(status: number, parsed: any): string {
  const apiMessage = typeof parsed?.message === "string" ? parsed.message : "";

  if (status === 401) {
    return "GitHub rejected the token (401 Bad credentials). It may be expired or revoked — create a new one and paste it in the Auth Token tab.";
  }
  if (status === 403) {
    if (/rate limit/i.test(apiMessage)) {
      return "GitHub rate limit reached (403). Wait a few minutes and try again.";
    }
    return "GitHub refused the request (403). Your token most likely lacks the required permission — for a fine-grained token set Contents to Read and write (and Metadata to Read).";
  }
  if (status === 404) {
    return "Not found (404). Check the repository name and branch, and make sure your token can access this repository.";
  }
  if (status === 409) {
    return "This repository is empty (409). Cursive will create the branch on the first push.";
  }
  if (status === 422) {
    return apiMessage || "GitHub could not apply the change (422). Check the branch name and file paths.";
  }
  if (status >= 500) {
    return `GitHub had a server error (${status}). Try again in a moment.`;
  }
  return apiMessage || `GitHub returned HTTP ${status}.`;
}

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                    */
/* ------------------------------------------------------------------ */

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToText(base64: string): string {
  const clean = base64.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function normalizePath(path: string, fallbackName: string): string {
  const raw = (path || fallbackName || "").replace(/\\/g, "/").trim();
  return raw.replace(/^\.?\//, "").replace(/^\/+/, "");
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export async function verifyToken(token: string): Promise<GitHubUser> {
  if (!token.trim()) {
    throw new GitHubError(401, "Enter a token first.");
  }
  return apiJson<GitHubUser>(`${API}/user`, { token: token.trim() });
}

export async function listRepos(token: string): Promise<GitHubRepoInfo[]> {
  const repos = await apiJson<GitHubRepoInfo[]>(
    `${API}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
    { token: token.trim() }
  );
  return Array.isArray(repos) ? repos : [];
}

export async function getRepoInfo(
  token: string,
  repo: string
): Promise<GitHubRepoInfo> {
  return apiJson<GitHubRepoInfo>(`${API}/repos/${normalizeRepo(repo)}`, {
    token: token.trim(),
  });
}

function normalizeRepo(repo: string): string {
  const trimmed = repo.trim().replace(/^https?:\/\/github\.com\//i, "");
  return trimmed.replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
}

function branchUrl(repo: string, branch: string): string {
  return `${API}/repos/${normalizeRepo(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
}

/* ------------------------------------------------------------------ */
/* Pull                                                                */
/* ------------------------------------------------------------------ */

const SKIP_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar", ".jar", ".aar", ".apk",
  ".exe", ".dll", ".so", ".dylib", ".class", ".bin", ".woff", ".woff2",
  ".ttf", ".otf", ".eot", ".mp3", ".mp4", ".mov", ".avi", ".wav", ".ogg",
  ".pyc", ".pyo", ".lock",
];

const SKIP_DIRECTORIES = [
  "node_modules/", ".git/", ".next/", "dist/", "build/", "out/",
  "__pycache__/", ".venv/", "venv/", ".gradle/",
];

const MAX_FILES = 60;
const MAX_FILE_BYTES = 200_000;

function isTextCandidate(path: string): boolean {
  const lower = path.toLowerCase();
  if (SKIP_DIRECTORIES.some((dir) => lower.includes(dir))) return false;
  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  return true;
}

export async function pullRepo(
  token: string,
  repo: string,
  branchInput?: string
): Promise<{ branch: string; files: GitHubPulledFile[] }> {
  const slug = normalizeRepo(repo);
  if (!slug.includes("/")) {
    throw new GitHubError(400, "Enter the repository as owner/repo, e.g. octocat/hello-world.");
  }

  const info = await getRepoInfo(token, slug);
  const branch = branchInput?.trim() || info.default_branch;

  const tree = await apiJson<{ tree: any[] }>(branchUrl(slug, branch), {
    token: token.trim(),
  });

  const blobs = (tree.tree || [])
    .filter((item) => item?.type === "blob" && typeof item?.path === "string")
    .filter((item) => isTextCandidate(item.path))
    .filter((item) => typeof item.size !== "number" || item.size <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES);

  const files: GitHubPulledFile[] = [];
  for (const blob of blobs) {
    try {
      const contents = await apiJson<{
        content?: string;
        encoding?: string;
      }>(
        `${API}/repos/${slug}/contents/${encodeURIComponentPath(blob.path)}?ref=${encodeURIComponent(branch)}`,
        { token: token.trim() }
      );
      if (contents?.encoding === "base64" && contents.content) {
        files.push({
          path: `/${blob.path}`,
          name: blob.path.split("/").pop() || blob.path,
          content: base64ToText(contents.content),
        });
      }
    } catch {
      // Skip individual files we cannot read (too large, binary, etc.).
    }
  }

  return { branch, files };
}

function encodeURIComponentPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/* ------------------------------------------------------------------ */
/* Push                                                                */
/* ------------------------------------------------------------------ */

interface RefResponse {
  object: { sha: string };
}

async function maybeGetRef(
  token: string,
  repo: string,
  branch: string
): Promise<RefResponse | null> {
  try {
    return await apiJson<RefResponse>(
      `${API}/repos/${normalizeRepo(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
      { token: token.trim() }
    );
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 404 || err.status === 409)) {
      return null;
    }
    throw err;
  }
}

export async function pushFiles(
  token: string,
  repo: string,
  branchInput: string,
  message: string,
  files: GitHubPushedFile[]
): Promise<{ branch: string; count: number; commitUrl?: string }> {
  const slug = normalizeRepo(repo);
  if (!slug.includes("/")) {
    throw new GitHubError(400, "Enter the repository as owner/repo, e.g. octocat/hello-world.");
  }

  const entries = files
    .map((file) => ({
      path: normalizePath(file.path, ""),
      content: file.content ?? "",
    }))
    .filter((file) => file.path.length > 0);

  if (entries.length === 0) {
    throw new GitHubError(400, "There are no files to push.");
  }

  const info = await getRepoInfo(token, slug);
  const branch = branchInput?.trim() || info.default_branch;
  const commitMessage = message?.trim() || "Update files via Cursive";

  let ref = await maybeGetRef(token, slug, branch);
  if (!ref && branch !== info.default_branch) {
    // Branch does not exist yet, but the repository has commits: create it
    // from the default branch, then commit onto it.
    const defaultRef = await maybeGetRef(token, slug, info.default_branch);
    if (defaultRef) {
      await apiJson(`${API}/repos/${slug}/git/refs`, {
        method: "POST",
        token: token.trim(),
        body: { ref: `refs/heads/${branch}`, sha: defaultRef.object.sha },
      });
      ref = defaultRef;
    }
  }

  if (ref) {
    // Multi-file atomic commit via the Git Data API.
    const treeEntries = await Promise.all(
      entries.map(async (entry) => {
        const blob = await apiJson<{ sha: string }>(
          `${API}/repos/${slug}/git/blobs`,
          {
            method: "POST",
            token: token.trim(),
            body: { content: textToBase64(entry.content), encoding: "base64" },
          }
        );
        return {
          path: entry.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        };
      })
    );

    const baseCommit = await apiJson<{ tree: { sha: string } }>(
      `${API}/repos/${slug}/git/commits/${ref.object.sha}`,
      { token: token.trim() }
    );

    const newTree = await apiJson<{ sha: string }>(
      `${API}/repos/${slug}/git/trees`,
      {
        method: "POST",
        token: token.trim(),
        body: { base_tree: baseCommit.tree.sha, tree: treeEntries },
      }
    );

    const newCommit = await apiJson<{ sha: string; html_url?: string }>(
      `${API}/repos/${slug}/git/commits`,
      {
        method: "POST",
        token: token.trim(),
        body: {
          message: commitMessage,
          tree: newTree.sha,
          parents: [ref.object.sha],
        },
      }
    );

    await apiJson(
      `${API}/repos/${slug}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: "PATCH",
        token: token.trim(),
        body: { sha: newCommit.sha, force: false },
      }
    );

    return { branch, count: entries.length, commitUrl: newCommit.html_url };
  }

  // Empty repository: the Git Data API has no commits to build on, so create
  // the files with the Contents API. The first write creates the branch.
  for (const entry of entries) {
    await apiJson(
      `${API}/repos/${slug}/contents/${encodeURIComponentPath(entry.path)}`,
      {
        method: "PUT",
        token: token.trim(),
        body: {
          message: commitMessage,
          content: textToBase64(entry.content),
          branch,
        },
      }
    );
  }

  return { branch, count: entries.length };
}
