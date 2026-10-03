"use client";

import React from "react";
import {
  NewFileTemplate,
} from "@/lib/examples";
import { ProjectTemplate, STARTER_TEMPLATES } from "@/lib/templates";
import { X, Sparkles, ArrowRight, FilePlus2 } from "lucide-react";

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
  /** Optional short snippets ("New from template"). Never used automatically. */
  onSelectSnippet?: (template: NewFileTemplate) => void;
  snippets?: NewFileTemplate[];
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onSelectSnippet,
  snippets = [],
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                New from template
              </h2>
              <p className="text-[11px] text-slate-400">
                Optional starters. A normal new file is always blank.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Short snippets */}
          {snippets.length > 0 && onSelectSnippet && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                Starter snippets
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    onClick={() => {
                      onSelectSnippet(snippet);
                      onClose();
                    }}
                    className="group flex flex-col justify-between p-4 rounded-xl border border-slate-800 hover:border-emerald-500 bg-slate-950/60 hover:bg-emerald-950/20 cursor-pointer transition-all shadow hover:shadow-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{snippet.icon}</span>
                        <FilePlus2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                        {snippet.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {snippet.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                      <span className="font-mono">{snippet.fileName}</span>
                      <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Full starter projects */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Starter projects
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => {
                    onSelectTemplate(tmpl);
                    onClose();
                  }}
                  className="group flex flex-col justify-between p-4 rounded-xl border border-slate-800 hover:border-blue-500 bg-slate-950/60 hover:bg-blue-950/20 cursor-pointer transition-all shadow hover:shadow-lg"
                >
                  <div>
                    <div className="text-2xl mb-2">{tmpl.icon}</div>
                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-blue-300 transition-colors">
                      {tmpl.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-blue-400 font-medium">
                    <span>{tmpl.files.length} files included</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </section>
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
