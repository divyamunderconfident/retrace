import Link from "next/link";
import { Badge, H1 } from "@/components/ui";
import { readData, type Index } from "@/lib/data";

export default function Home() {
  const { runs, diffs } = readData<Index>("index.json");
  return (
    <>
      <H1 sub="Record every step of an agent run, replay it for free, fork it at any step, and diff two runs to find where they split.">
        Retrace: a time-travel debugger for AI agents
      </H1>

      <section className="mb-8">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Diffs: seeded bug vs correct run</h2>
        <div className="overflow-x-auto rounded border border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 text-xs text-zinc-400">
              <tr>
                <th className="px-3 py-2">Mutation</th>
                <th className="px-3 py-2">Bug type</th>
                <th className="px-3 py-2">Mutated step</th>
                <th className="px-3 py-2">First divergence</th>
                <th className="px-3 py-2">What changed</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d) => (
                <tr key={d.id} className="border-t border-zinc-800 hover:bg-zinc-900/60">
                  <td className="px-3 py-2 font-mono">
                    <Link href={`/diffs/${d.id}`} className="text-emerald-400 hover:underline">{d.id}</Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{d.type}</td>
                  <td className="px-3 py-2 font-mono">{d.mutated_step ?? "-"}</td>
                  <td className="px-3 py-2 font-mono">{d.first_divergence ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-400">{d.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Runs</h2>
        <div className="overflow-x-auto rounded border border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 text-xs text-zinc-400">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2 text-right">Steps</th>
                <th className="px-3 py-2 text-right">Tokens</th>
                <th className="px-3 py-2">Answer</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800 align-top hover:bg-zinc-900/60">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    <Link href={`/runs/${r.id}`} className="text-emerald-400 hover:underline">{r.id.slice(0, 8)}</Link>
                    <div className="text-xs text-zinc-500">{r.mutation}</div>
                  </td>
                  <td className="px-3 py-2"><Badge>{r.role}</Badge></td>
                  <td className="px-3 py-2 text-zinc-300">{r.question}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.steps}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.tokens.toLocaleString("en-US")}</td>
                  <td className="max-w-xs px-3 py-2 text-zinc-400">{r.answer.slice(0, 140)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
