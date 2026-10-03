"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileItem, Project } from "@/types";
import {
  Github,
  X,
  UploadCloud,
  DownloadCloud,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  WifiOff,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  GitHubError,
  pullRepo,
  pushFiles,
  verifyToken,
  listRepos,
  type GitHubRepoInfo,
} from "@/lib/github";
import { getSecret, setSecret, removeSecret } from "@/lib/secrets";
import { useOnlineStatus } from "@/lib/use-online-status";

interface GitHubModalProps {
  isOpen: boolean;
  project: Project | null;
  files: FileItem[];
  onClose: () => void;
  onImportFiles: (
    importedFiles: { name: string; path: string; content: string }[],
    repoName: string
  ) => void;
}

const TOKEN_KEY = "cursive_github_token";
const USER_KEY = "cursive_github_user";
const RECENT_KEY = "cursive_github_recent_repos";
const DRAFT_KEY = "cursive_github_draft";

interface Draft {
  repo: string;
  branch: string;
  commitMessage: string;
}

const DEFAULT_COMMIT_MESSAGE = "Update files via Cursive";

const TOKEN_GENERATOR_URL =
  "https://github.com/settings/tokens/new?scopes=repo&description=Cursive";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  project,
  files,
  onClose,
  onImportFiles,
}) => {
  const online = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<"push" | "pull" | "token">("push");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connectedUser, setConnectedUser] = useState<string | null>(null);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState(DEFAULT_COMMIT_MESSAGE);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoInfo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [pending, setPending] = useState<"verify" | "pull" | "push" | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
    href?: string;
  } | null>(null);

  // Load saved token, connection and drafts the first time the modal opens.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      const draft = readJson<Draft>(DRAFT_KEY, {
        repo: project?.githubRepo || "",
        branch: project?.githubBranch || "main",
        commitMessage: DEFAULT_COMMIT_MESSAGE,
      });
      setRepo(draft.repo || project?.githubRepo || "");
      setBranch(draft.branch || project?.githubBranch || "main");
      setCommitMessage(draft.commitMessage || DEFAULT_COMMIT_MESSAGE);
      setRecentRepos(readJson<string[]>(RECENT_KEY, []));

      const savedUser = readJson<string | null>(USER_KEY, null);
      if (savedUser) setConnectedUser(savedUser);

      const savedToken = await getSecret(TOKEN_KEY);
      if (savedToken) {
        setToken(savedToken);
        if (!savedUser) {
          try {
            const user = await verifyToken(savedToken);
            setConnectedUser(user.login);
            writeJson(USER_KEY, user.login);
          } catch {
            /* leave unverified */
          }
        }
      }
    })();
  }, [isOpen, project?.githubRepo, project?.githubBranch]);

  // Keep drafts of the last repo / branch / commit message.
  useEffect(() => {
    if (!isOpen) return;
    writeJson(DRAFT_KEY, { repo, branch, commitMessage } satisfies Draft);
  }, [isOpen, repo, branch, commitMessage]);

  const rememberRepo = useCallback((fullName: string) => {
    setRecentRepos((prev) => {
      const next = [fullName, ...prev.filter((r) => r !== fullName)].slice(0, 5);
      writeJson(RECENT_KEY, next);
      return next;
    });
  }, []);

  const describeError = (err: unknown): string => {
    if (err instanceof GitHubError) return err.message;
    if (err instanceof Error) return err.message;
    return "Something went wrong talking to GitHub.";
  };

  const handleSaveAndConnect = async () => {
    if (!online) {
      setStatusMessage({ type: "error", text: "No internet — connect to the internet to use GitHub." });
      return;
    }
    if (!token.trim()) {
      setStatusMessage({ type: "error", text: "Enter a token first." });
      return;
    }
    setPending("verify");
    setStatusMessage(null);
    try {
      const user = await verifyToken(token);
      await setSecret(TOKEN_KEY, token.trim());
      setToken(token.trim());
      setConnectedUser(user.login);
      writeJson(USER_KEY, user.login);
      setStatusMessage({
        type: "success",
        text: `Connected as ${user.login}${
          user.name ? ` (${user.name})` : ""
        }. Your token is stored encrypted on this device.`,
      });
      void loadRepos();
    } catch (err) {
      setStatusMessage({ type: "error", text: describeError(err) });
    } finally {
      setPending(null);
    }
  };

  const handleDisconnect = async () => {
    await removeSecret(TOKEN_KEY);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_KEY);
    }
    setToken("");
    setConnectedUser(null);
    setAvailableRepos([]);
    setStatusMessage({ type: "info", text: "Disconnected. The stored token was removed from this device." });
  };

  const loadRepos = async () => {
    if (!token.trim() || !online) return;
    setIsLoadingRepos(true);
    try {
      const repos = await listRepos(token);
      setAvailableRepos(repos);
    } catch {
      // Non-fatal: the repo list is a convenience, typing still works.
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handlePush = async () => {
    if (!online) {
      setStatusMessage({ type: "error", text: "No internet — connect to the internet to push." });
      return;
    }
    if (!token.trim()) {
      setStatusMessage({ type: "error", text: "Add a GitHub token in the Auth Token tab before pushing." });
      setActiveTab("token");
      return;
    }
    if (!repo.trim()) {
      setStatusMessage({ type: "error", text: "Enter a repository (owner/repo)." });
      return;
    }

    const projectFiles = files
      .filter((f) => f.projectId === project?.id && !f.isFolder)
      .map((f) => ({ path: f.path || f.name, content: f.content ?? "" }));

    if (projectFiles.length === 0) {
      setStatusMessage({ type: "error", text: "There are no files in this project to push." });
      return;
    }

    setPending("push");
    setStatusMessage(null);
    try {
      const result = await pushFiles(token, repo, branch, commitMessage, projectFiles);
      rememberRepo(repo.trim());
      setBranch(result.branch);
      setStatusMessage({
        type: "success",
        text: `Pushed ${result.count} file(s) to ${repo.trim()} (${result.branch}).`,
        href: result.commitUrl,
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: describeError(err) });
    } finally {
      setPending(null);
    }
  };

  const handlePull = async () => {
    if (!online) {
      setStatusMessage({ type: "error", text: "No internet — connect to the internet to pull." });
      return;
    }
    if (!repo.trim()) {
      setStatusMessage({ type: "error", text: "Enter a repository (owner/repo)." });
      return;
    }

    setPending("pull");
    setStatusMessage(null);
    try {
      const result = await pullRepo(token, repo, branch);
      if (result.files.length === 0) {
        setStatusMessage({
          type: "info",
          text: `No importable text files were found in ${repo.trim()} (${result.branch}).`,
        });
        return;
      }
      onImportFiles(result.files, repo.trim());
      rememberRepo(repo.trim());
      setBranch(result.branch);
      setStatusMessage({
        type: "success",
        text: `Imported ${result.files.length} file(s) from ${repo.trim()} (${result.branch}).`,
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: describeError(err) });
    } finally {
      setPending(null);
    }
  };

  if (!isOpen) return null;

  const tabButton = (
    tab: "push" | "pull" | "token",
    label: string,
    Icon: typeof UploadCloud
  ) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
        activeTab === tab
          ? "bg-blue-600 text-white shadow"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  const repoField = (placeholder: string) => (
    <div className="space-y-1">
      <label className="text-xs text-slate-300 font-medium">Repository (owner/repo)</label>
      <div className="relative">
        <input
          type="text"
          list="cursive-recent-repos"
          placeholder={placeholder}
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
        />
        {repo && (
          <button
            type="button"
            onClick={() => setRepo("")}
            title="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <Github className="w-5 h-5 text-slate-100 shrink-0" />
            <h2 className="text-base font-bold text-slate-100 truncate">GitHub Sync</h2>
            {connectedUser && (
              <span className="ml-1 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[10px] font-semibold text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                {connectedUser}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          {tabButton("push", "Push", UploadCloud)}
          {tabButton("pull", "Pull / Import", DownloadCloud)}
          {tabButton("token", "Auth Token", Key)}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!online && (
            <div className="p-3 rounded-xl border border-amber-800/60 bg-amber-950/40 flex items-start gap-2 text-xs text-amber-300">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                No internet. The editor, Python and your files still work offline — GitHub sync
                resumes when you reconnect.
              </span>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                  : statusMessage.type === "info"
                  ? "bg-slate-950 border-slate-800 text-slate-300"
                  : "bg-red-950/40 border-red-800/60 text-red-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : statusMessage.type === "info" ? (
                <Github className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <span className="min-w-0">
                {statusMessage.text}
                {statusMessage.href && (
                  <a
                    href={statusMessage.href}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-1 text-blue-400 hover:underline"
                  >
                    View commit <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </span>
            </div>
          )}

          {/* Recent repos datalist */}
          <datalist id="cursive-recent-repos">
            {availableRepos.map((r) => (
              <option key={r.full_name} value={r.full_name}>
                {r.private ? "private" : "public"}
                {r.description ? ` — ${r.description}` : ""}
              </option>
            ))}
            {recentRepos
              .filter((r) => !availableRepos.some((a) => a.full_name === r))
              .map((r) => (
                <option key={`recent-${r}`} value={r} />
              ))}
          </datalist>

          {activeTab === "push" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Commit every file in <strong className="text-slate-200">{project?.name}</strong> to
                your GitHub repository as a single commit.
              </p>

              {repoField("octocat/my-project")}
              {recentRepos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recentRepos.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRepo(r)}
                      className="px-2 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">Branch</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs text-slate-300 font-medium">Commit message</label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePush}
                disabled={pending !== null || !online}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {pending === "push" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{pending === "push" ? "Pushing..." : "Push files to GitHub"}</span>
              </button>
            </div>
          )}

          {activeTab === "pull" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Import text files from any public repo, or your private repos when a token is
                connected. Files are added to this project and never overwrite existing ones.
              </p>

              {repoField("torvalds/linux")}

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Branch (optional, defaults to the repo&apos;s default branch)
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {recentRepos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recentRepos.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRepo(r)}
                      className="px-2 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handlePull}
                disabled={pending !== null || !online}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {pending === "pull" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                <span>{pending === "pull" ? "Importing..." : "Pull repository into Cursive"}</span>
              </button>
            </div>
          )}

          {activeTab === "token" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Connect a GitHub Personal Access Token to push to public and private repositories.
                The token is stored encrypted on this device and is only ever sent to GitHub.
              </p>

              {connectedUser && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-800/60 bg-emerald-950/30">
                  <span className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected as {connectedUser}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  GitHub Personal Access Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_... or github_pat_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    title={showToken ? "Hide token" : "Show token"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAndConnect}
                disabled={pending !== null || !online}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {pending === "verify" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                <span>{pending === "verify" ? "Checking..." : "Save & connect"}</span>
              </button>

              {connectedUser && (
                <button
                  type="button"
                  onClick={loadRepos}
                  disabled={isLoadingRepos || !online}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {isLoadingRepos ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>{availableRepos.length > 0 ? "Refresh repo list" : "Load my repositories"}</span>
                </button>
              )}

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
                <div className="font-semibold text-slate-200">Creating a token</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="text-slate-300">Classic token:</span> tick the{" "}
                    <code className="text-blue-300">repo</code> scope.
                  </li>
                  <li>
                    <span className="text-slate-300">Fine-grained token:</span> give it access to
                    your repositories and set{" "}
                    <code className="text-blue-300">Contents: Read and write</code> plus{" "}
                    <code className="text-blue-300">Metadata: Read</code>.
                  </li>
                </ul>
                <a
                  href={TOKEN_GENERATOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:underline pt-1"
                >
                  <span>Open GitHub token generator</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
