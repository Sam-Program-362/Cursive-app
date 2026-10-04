"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Download,
  FlaskConical,
  ExternalLink,
  KeyRound,
  Server,
} from "lucide-react";
import {
  PROVIDER_PRESETS,
  CONTEXT_TOKEN_CHOICES,
  DEFAULT_TOKEN_LIMITS,
  RESPONSE_TOKEN_CHOICES,
  type AiConnection,
  type ProviderKind,
  type TokenLimits,
  deleteConnection,
  fetchModels,
  getActiveConnectionId,
  getPreset,
  listConnections,
  loadTokenLimits,
  makeConnectionId,
  migrateLegacyConfig,
  normalizeBaseUrl,
  pickActiveConnection,
  saveConnection,
  testConnection,
} from "@/lib/ai-connections";

interface Draft extends AiConnection {
  isNew: boolean;
}

function blankDraft(): Draft {
  const preset = getPreset("openrouter");
  return {
    id: makeConnectionId(),
    name: "My connection",
    provider: preset.id,
    baseUrl: preset.baseUrl,
    model: preset.defaultModel,
    isNew: true,
  };
}

type Status = { kind: "idle" | "busy" | "ok" | "error"; message: string } | null;

export const AiConnectionsSettings: React.FC = () => {
  const [connections, setConnections] = useState<
    (AiConnection & { hasKey: boolean })[]
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [testStatus, setTestStatus] = useState<Status>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelFilter, setModelFilter] = useState("");
  const [globalLimits, setGlobalLimits] = useState<TokenLimits>({
    ...DEFAULT_TOKEN_LIMITS,
  });

  const refresh = useCallback(async () => {
    setConnections(await listConnections());
    setActiveId(getActiveConnectionId());
  }, []);

  useEffect(() => {
    setGlobalLimits(loadTokenLimits());
    (async () => {
      await migrateLegacyConfig();
      await refresh();
    })();
  }, [refresh]);

  const startAdd = () => {
    setDraft(blankDraft());
    setKeyInput("");
    setModels(null);
    setModelFilter("");
    setStatus(null);
    setTestStatus(null);
  };

  const startEdit = (connection: AiConnection) => {
    setDraft({ ...connection, isNew: false });
    setKeyInput("");
    setModels(null);
    setModelFilter("");
    setStatus(null);
    setTestStatus(null);
  };

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  /** Set or clear one per-connection override ("" = follow the global value). */
  const setOverride = (key: keyof TokenLimits, raw: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const overrides: Partial<TokenLimits> = { ...(prev.overrides || {}) };
      if (raw === "") delete overrides[key];
      else if (key === "maxResponseTokens") {
        overrides.maxResponseTokens = raw === "model" ? "model" : Number(raw);
      } else if (key === "maxContextTokens") {
        overrides.maxContextTokens = Number(raw);
      } else {
        overrides.temperature = raw === "provider" ? null : Number(raw);
      }
      return { ...prev, overrides };
    });
  };

  const handleProviderChange = (kind: ProviderKind) => {
    const preset = getPreset(kind);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            provider: kind,
            baseUrl: preset.baseUrl,
            model: prev.model.trim() ? prev.model : preset.defaultModel,
          }
        : prev
    );
    setModels(null);
    setModelFilter("");
  };

  const handleSave = async () => {
    if (!draft) return;
    setStatus({ kind: "busy", message: "Saving…" });
    try {
      const connection: AiConnection = {
        id: draft.id,
        name: draft.name.trim() || getPreset(draft.provider).label,
        provider: draft.provider,
        baseUrl: normalizeBaseUrl(draft.baseUrl),
        model: draft.model.trim(),
        ...(draft.overrides && Object.keys(draft.overrides).length > 0
          ? { overrides: draft.overrides }
          : {}),
      };
      await saveConnection(connection, keyInput || undefined);
      if (draft.isNew) await pickActiveConnection(connection.id);
      await refresh();
      setDraft(null);
      setKeyInput("");
      setStatus({ kind: "ok", message: "Connection saved." });
    } catch {
      setStatus({ kind: "error", message: "Could not save the connection." });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteConnection(id);
    await refresh();
    setDraft((prev) => (prev && prev.id === id ? null : prev));
    setStatus({ kind: "ok", message: "Connection deleted." });
  };

  const handlePickActive = async (id: string) => {
    await pickActiveConnection(id);
    setActiveId(id);
  };

  const handleFetchModels = async () => {
    if (!draft) return;
    setStatus({ kind: "busy", message: "Fetching models…" });
    setTestStatus(null);
    try {
      const connection: AiConnection = {
        id: draft.id,
        name: draft.name,
        provider: draft.provider,
        baseUrl: normalizeBaseUrl(draft.baseUrl),
        model: draft.model,
      };
      // Make sure a freshly-typed key is saved before we call the provider.
      if (keyInput.trim()) await saveConnection(connection, keyInput);
      const list = await fetchModels(connection);
      setModels(list);
      if (list.length === 0) {
        setStatus({
          kind: "ok",
          message: "No model list from this provider — type the model name instead.",
        });
      } else {
        setStatus({ kind: "ok", message: `Found ${list.length} models.` });
      }
    } catch (error) {
      setModels(null);
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not fetch models.",
      });
    }
  };

  const handleTest = async () => {
    if (!draft) return;
    setTestStatus({ kind: "busy", message: "Testing…" });
    try {
      const connection: AiConnection = {
        id: draft.id,
        name: draft.name,
        provider: draft.provider,
        baseUrl: normalizeBaseUrl(draft.baseUrl),
        model: draft.model,
      };
      if (keyInput.trim()) await saveConnection(connection, keyInput);
      const result = await testConnection(connection);
      setTestStatus({
        kind: result.ok ? "ok" : "error",
        message: result.message,
      });
    } catch (error) {
      setTestStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "The test failed.",
      });
    }
  };

  const preset = draft ? getPreset(draft.provider) : null;
  const savedConnection = draft
    ? connections.find((c) => c.id === draft.id)
    : undefined;
  const filteredModels =
    models && models.length > 0
      ? models
          .filter((m) => m.toLowerCase().includes(modelFilter.toLowerCase()))
          .slice(0, 100)
      : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        <span>AI connections</span>
      </div>

      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
        {/* Saved connections */}
        {connections.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            No connections yet. Add one to use real AI (OpenRouter, OpenAI,
            Anthropic, Gemini, a local server and more).
          </p>
        ) : (
          <div className="space-y-1.5">
            {connections.map((connection) => {
              const isActive = connection.id === activeId;
              return (
                <div
                  key={connection.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    isActive
                      ? "border-purple-600/60 bg-purple-950/30"
                      : "border-slate-800 bg-slate-900/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handlePickActive(connection.id)}
                    title={isActive ? "Active connection" : "Use this connection"}
                    className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                      isActive
                        ? "border-purple-500 bg-purple-600 text-white"
                        : "border-slate-600 text-transparent hover:border-purple-500"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePickActive(connection.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {connection.name}
                      </span>
                      {connection.hasKey ? (
                        <KeyRound className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-amber-400 shrink-0">
                          no key
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {getPreset(connection.provider).label}
                      {connection.model ? ` · ${connection.model}` : ""}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(connection)}
                    title="Edit"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(connection.id)}
                    title="Delete"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!draft && (
          <button
            type="button"
            onClick={startAdd}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add connection</span>
          </button>
        )}
      </div>

      {/* Editor */}
      {draft && preset && (
        <div className="p-3 bg-slate-950/60 rounded-xl border border-purple-800/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              {draft.isNew ? "New connection" : "Edit connection"}
            </span>
            <Server className="w-3.5 h-3.5 text-purple-300" />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              placeholder="e.g. OpenRouter — free model"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Provider</label>
            <select
              value={draft.provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderKind)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">
              API base URL <span className="text-slate-500">(editable)</span>
            </label>
            <input
              type="text"
              value={draft.baseUrl}
              onChange={(e) => updateDraft({ baseUrl: e.target.value })}
              placeholder={preset.baseUrl || "https://example.com/v1"}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">
              API key{" "}
              {savedConnection?.hasKey ? (
                <span className="text-emerald-400">(saved — paste a new one to replace)</span>
              ) : keyInput ? (
                <span className="text-amber-400">(not saved yet)</span>
              ) : null}
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={preset.keyPlaceholder}
              autoComplete="off"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Model</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.model}
                onChange={(e) => updateDraft({ model: e.target.value })}
                placeholder={preset.defaultModel || "type a model name"}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleFetchModels}
                title="Fetch the provider's model list"
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Fetch</span>
              </button>
            </div>
            {models && models.length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                <input
                  type="text"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  placeholder={`Search ${models.length} models…`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/60">
                  {filteredModels.length === 0 ? (
                    <div className="p-2 text-[11px] text-slate-500">
                      No match — type the model name manually above.
                    </div>
                  ) : (
                    filteredModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => updateDraft({ model })}
                        className={`w-full text-left px-2 py-1.5 text-[11px] font-mono hover:bg-slate-800 ${
                          model === draft.model
                            ? "text-purple-300 bg-purple-950/30"
                            : "text-slate-300"
                        }`}
                      >
                        {model}
                      </button>
                    ))
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Pick from {models.length} models
                </p>
              </div>
            )}
          </div>

          {/* Token-limit overrides for this connection */}
          <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
            <label className="text-[11px] text-slate-400">
              Token limits{" "}
              {draft.overrides && Object.keys(draft.overrides).length > 0 ? (
                <span className="text-amber-400">
                  ({Object.keys(draft.overrides).length} override
                  {Object.keys(draft.overrides).length > 1 ? "s" : ""})
                </span>
              ) : (
                <span className="text-slate-500">(using global defaults)</span>
              )}
            </label>
            <select
              value={
                draft.overrides?.maxResponseTokens !== undefined
                  ? String(draft.overrides.maxResponseTokens)
                  : ""
              }
              onChange={(e) => setOverride("maxResponseTokens", e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="">
                Global default (
                {globalLimits.maxResponseTokens === "model"
                  ? "Model default"
                  : globalLimits.maxResponseTokens}
                ) — max response tokens
              </option>
              <option value="model">Model default (provider decides)</option>
              {RESPONSE_TOKEN_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value} tokens — max response
                </option>
              ))}
            </select>
            <select
              value={
                draft.overrides?.maxContextTokens !== undefined
                  ? String(draft.overrides.maxContextTokens)
                  : ""
              }
              onChange={(e) => setOverride("maxContextTokens", e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="">
                Global default ({globalLimits.maxContextTokens}) — max context
                tokens
              </option>
              {CONTEXT_TOKEN_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value} tokens — max context
                </option>
              ))}
            </select>
            <select
              value={
                draft.overrides?.temperature === undefined
                  ? ""
                  : draft.overrides.temperature === null
                  ? "provider"
                  : String(draft.overrides.temperature)
              }
              onChange={(e) => setOverride("temperature", e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="">
                Global default (
                {globalLimits.temperature === null
                  ? "Provider default"
                  : globalLimits.temperature.toFixed(1)}
                ) — temperature
              </option>
              <option value="provider">Provider default — temperature</option>
              {[0, 0.3, 0.5, 0.7, 1, 1.5, 2].map((value) => (
                <option key={value} value={value}>
                  {value.toFixed(1)} — temperature
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              Leave on “Global default” to follow Settings → AI. Overrides apply
              only to this connection.
            </p>
          </div>

          {preset.note && (
            <p className="text-[11px] text-slate-400">{preset.note}</p>
          )}
          {preset.docsUrl && (
            <a
              href={preset.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:underline"
            >
              <span>Get a {preset.label} API key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={status?.kind === "busy"}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              {status?.kind === "busy" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus?.kind === "busy"}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              {testStatus?.kind === "busy" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5" />
              )}
              <span>Test</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setKeyInput("");
                setModels(null);
                setStatus(null);
                setTestStatus(null);
              }}
              className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs"
            >
              Cancel
            </button>
          </div>

          {status && (
            <p
              className={`text-[11px] ${
                status.kind === "error" ? "text-rose-300" : "text-slate-400"
              }`}
            >
              {status.message}
            </p>
          )}
          {testStatus && (
            <p
              className={`text-[11px] ${
                testStatus.kind === "error" ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {testStatus.message}
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Keys are stored encrypted on this device and sent only to the provider
        you choose. The connection marked with a check is used by the AI
        assistant.
      </p>
    </div>
  );
};
