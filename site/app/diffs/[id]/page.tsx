import Link from "next/link";
import { Badge, H1, Json, Stat } from "@/components/ui";
import { readData, type Diff, type Index, type Run, type Step } from "@/lib/data";
import { stepSummary } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return readData<Index>("index.json").diffs.map((d) => ({ id: d.id }));
}

function Cell({ step }: { step?: Step }) {
  if (!step) return <td className="px-3 py-2 font-mono text-xs text-zinc-600">missing</td>;
  return (
    <td className="px-3 py-2 align-top">
      <div className="flex items-center gap-2">
        <Badge>{step.type}</Badge>
        <span className="font-mono text-xs text-zinc-400">{step.name}</span>
      </div>
      <div className="mt-1 break-words font-mono text-xs text-zinc-300">{stepSummary(step)}</div>
    </td>
  );
}

function show(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export default async function DiffPage({ params }: PageProps<"/diffs/[id]">) {
  const { id } = await params;
  const meta = readData<Index>("index.json").diffs.find((d) => d.id === id)!;
  const d = readData<Diff>(`diffs/${id}.json`);
  const a = readData<Run>(`runs/${d.run_a}.json`).steps;
  const b = readData<Run>(`runs/${d.run_b}.json`).steps;
  const fd = d.first_divergence;
  const rows = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i);

  return (
    <>
      <H1 sub={<>{meta.description} <span className="text-zinc-500">({meta.type})</span></>}>
        <span className="font-mono">diff: {id}</span>
      </H1>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="First divergence" value={fd == null ? "none" : `step ${fd}`} note={d.kind ? `${d.kind} changed` : undefined} />
        <Stat label="Mutated step (ground truth)" value={meta.mutated_step == null ? "-" : `step ${meta.mutated_step}`}
              note={meta.mutated_step === fd ? "matches the diff" : "does not match"} />
        <Stat label="Steps" value={`${d.steps_a} → ${d.steps_b}`} />
        <Stat label="Tokens" value={`${d.tokens.delta > 0 ? "+" : ""}${d.tokens.delta.toLocaleString("en-US")}`}
              note={`${d.tokens.a.toLocaleString("en-US")} → ${d.tokens.b.toLocaleString("en-US")} · cost $${d.cost_usd.a.toFixed(4)} → $${d.cost_usd.b.toFixed(4)}`} />
      </div>

      {d.changes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">What changed at step {fd}</h2>
          <div className="space-y-2">
            {d.changes.map((c) => (
              <div key={c.path} className="rounded border border-amber-900/60 bg-amber-950/10 p-3">
                <div className="mb-2 font-mono text-xs text-amber-300">{c.path}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] text-zinc-500">a (correct)</div>
                    <Json value={show(c.a)} className="max-h-64" />
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] text-zinc-500">b (broken)</div>
                    <Json value={show(c.b)} className="max-h-64 border-rose-900/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Steps side by side</h2>
        <div className="overflow-x-auto rounded border border-zinc-800">
          <table className="w-full table-fixed text-left">
            <thead className="bg-zinc-900 text-xs text-zinc-400">
              <tr>
                <th className="w-12 px-3 py-2">#</th>
                <th className="px-3 py-2">
                  a: <Link href={`/runs/${d.run_a}`} className="font-mono text-emerald-400 hover:underline">{d.run_a.slice(0, 8)}</Link> (correct)
                </th>
                <th className="px-3 py-2">
                  b: <Link href={`/runs/${d.run_b}`} className="font-mono text-emerald-400 hover:underline">{d.run_b.slice(0, 8)}</Link> (broken)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i}
                  className={`border-t border-zinc-800 ${
                    i === fd ? "bg-amber-950/30 outline outline-1 -outline-offset-1 outline-amber-600" : fd != null && i < fd ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-3 py-2 align-top font-mono text-xs text-zinc-500">
                    {i}
                    {i === fd && <div className="text-amber-400">split</div>}
                  </td>
                  <Cell step={a[i]} />
                  <Cell step={b[i]} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Faded rows are identical in both runs.</p>
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Plain-text diff report</h2>
        <Json value={d.report} />
      </section>
    </>
  );
}
