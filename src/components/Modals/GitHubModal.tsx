"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

interface GitHubModalProps {
  isOpen: boolean;
  project: Project | null;
  files: FileItem[];
  onClose: () => void;
  onImportFiles: (importedFiles: { name: string; path: string; content: string }[], repoName: string) => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  project,
  files,
  onClose,
  onImportFiles,
}) => {
  const [activeTab, setActiveTab] = useState<"push" | "pull" | "token">("push");
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(project?.githubRepo || "");
  const [branch, setBranch] = useState(project?.githubBranch || "main");
  const [commitMessage, setCommitMessage] = useState("Update files via CodePad");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("codepad_github_token") || "";
      if (savedToken) setToken(savedToken);
    }
  }, []);

  if (!isOpen) return null;

  const handleSaveToken = (newToken: string) => {
    setToken(newToken);
    if (typeof window !== "undefined") {
      localStorage.setItem("codepad_github_token", newToken);
    }
    setStatusMessage({
      type: "success",
      text: "GitHub token saved locally!",
    });
  };

  const handlePush = async () => {
    if (!repo.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a repository (e.g. username/repo)" });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const projectFiles = files.filter((f) => f.projectId === project?.id && !f.isFolder);

    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "push",
          token: token.trim(),
          repo: repo.trim(),
          branch: branch.trim(),
          message: commitMessage.trim(),
          files: projectFiles,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: "success",
          text: `Successfully pushed ${data.pushedFiles?.length || 0} file(s) to ${repo} (${branch})!`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to push files to GitHub.",
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePull = async () => {
    if (!repo.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a repository (e.g. username/repo)" });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: token.trim() ? "pull" : "pull_public",
          token: token.trim(),
          repo: repo.trim(),
          branch: branch.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.files) {
        onImportFiles(data.files, repo.trim());
        setStatusMessage({
          type: "success",
          text: `Successfully imported ${data.files.length} file(s) from ${repo}!`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to pull files from GitHub repo.",
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-slate-100" />
            <h2 className="text-base font-bold text-slate-100">
              GitHub Sync & Integration
            </h2>
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
          <button
            type="button"
            onClick={() => setActiveTab("push")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "push"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Push to Repo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pull")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "pull"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Pull / Import</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("token")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "token"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Auth Token</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                  : "bg-red-950/40 border-red-800/60 text-red-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === "push" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Commit and push all files in <strong>{project?.name}</strong> directly to your GitHub repository.
              </p>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Repository (owner/repo)
                </label>
                <input
                  type="text"
                  placeholder="e.g. octocat/my-codepad-project"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Branch
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Commit Message
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={handlePush}
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-4"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>Push Files to GitHub</span>
              </button>
            </div>
          )}

          {activeTab === "pull" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Import code files from any public or private GitHub repository into CodePad.
              </p>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Repository (owner/repo)
                </label>
                <input
                  type="text"
                  placeholder="e.g. torvalds/subsurface-for-dirk or username/repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Branch (optional, default: main)
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handlePull}
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-4"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                <span>Pull Repository into CodePad</span>
              </button>
            </div>
          )}

          {activeTab === "token" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Enter your GitHub Personal Access Token (classic or fine-grained) to enable committing to private and public repositories.
              </p>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  placeholder="ghp_..."
                  value={token}
                  onChange={(e) => handleSaveToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
                <div className="font-semibold text-slate-200">How to get a token:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Visit GitHub Settings &gt; Developer Settings &gt; Personal access tokens</li>
                  <li>Generate a token with <code>repo</code> permissions</li>
                  <li>Paste the token above to enable one-click pushes</li>
                </ol>
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:underline pt-1"
                >
                  <span>Open GitHub Token Generator</span>
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
