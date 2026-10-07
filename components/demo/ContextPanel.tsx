import { Bot, FileText, FolderGit2, Lock, User } from "lucide-react";
import type { Scenario } from "@/lib/types";
import { formatAction } from "@/lib/security/verdict";
import { isSensitivePath } from "@/lib/security/engine";

function HighlightedContent({ content, excerpt }: { content: string; excerpt?: string }) {
  const i = excerpt ? content.indexOf(excerpt) : -1;
  if (!excerpt || i < 0) return <>{content}</>;
  return (
    <>
      {content.slice(0, i)}
      <mark className="rounded-sm bg-red-500/25 px-0.5 text-red-200">{excerpt}</mark>
      {content.slice(i + excerpt.length)}
    </>
  );
}

export function ContextPanel({ scenario }: { scenario: Scenario }) {
  const file = scenario.files[0];
  const action = scenario.proposedAction;
  const fromUntrusted = action.origin.kind === "untrusted_content";

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          <User className="h-3.5 w-3.5" aria-hidden /> User request (trusted)
        </h2>
        <p className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sm text-sky-100">{scenario.userRequest}</p>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          <FolderGit2 className="h-3.5 w-3.5" aria-hidden /> Repository (simulated)
        </h2>
        <ul className="flex flex-wrap gap-1.5 font-mono text-xs text-zinc-400">
          {scenario.repoTree.map((p) =>
            isSensitivePath(p) ? (
              <li
                key={p}
                className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-amber-200"
                title="Sensitive file. Simulated: it has no real contents."
              >
                <Lock className="h-3 w-3" aria-hidden />
                {p}
              </li>
            ) : (
              <li key={p} className="rounded border border-white/10 px-2 py-0.5">
                {p}
              </li>
            ),
          )}
        </ul>
        <p className="mt-1.5 text-[11px] text-zinc-600">In-memory simulation. No real files are read.</p>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          <FileText className="h-3.5 w-3.5" aria-hidden /> {file.path}
          <span className="rounded border border-zinc-600 px-1.5 py-px text-[10px] tracking-wider text-zinc-400">UNTRUSTED</span>
        </h2>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-zinc-300">
          <HighlightedContent content={file.content} excerpt={action.origin.excerpt} />
        </pre>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          <Bot className="h-3.5 w-3.5" aria-hidden /> Simulated agent proposes
        </h2>
        <div className="rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100">
          {formatAction(action)}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          Origin:{" "}
          <span className={fromUntrusted ? "text-red-300" : "text-sky-300"}>
            {fromUntrusted ? `instruction found in ${action.origin.sourcePath} (untrusted)` : "user request (trusted)"}
          </span>
        </p>
      </div>
    </section>
  );
}
