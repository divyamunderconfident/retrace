import { H1, Stat } from "@/components/ui";
import { readData, type Results } from "@/lib/data";

function Mark({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-emerald-400" : "text-rose-400"}>{ok ? "yes" : "no"}</span>;
}

export const metadata = { title: "Results" };

export default function ResultsPage() {
  const { summary: s, mutations, root_cause } = readData<Results>("results.json");
  const b = Object.fromEntries(root_cause.map((r) => [r.id, r]));
  const n = Number(s.b_scored);
  return (
    <>
      <H1 sub={`Small mutation experiment: ${s.mutations} seeded bugs in the demo agent, 2 for each of 5 bug types, one trial each. Numbers come from results/ in the repo.`}>
        Results
      </H1>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Stat label="A · diff finds the mutated step" value={`${s.a_matches} / ${s.fired}`}
              note="First divergence equals the step the mutation first changed." />
        <Stat label="B · root cause from raw JSON logs" value={`${s.b_raw_logs_correct} / ${n}`}
              note={`Step right ${s.b_raw_logs_step_correct}, bug type right ${s.b_raw_logs_type_correct}.`} />
        <Stat label="B · root cause from diff report" value={`${s.b_diff_report_correct} / ${n}`}
              note={`Step right ${s.b_diff_report_step_correct}, bug type right ${s.b_diff_report_type_correct}.`} />
      </div>

      <p className="mb-6 max-w-3xl text-zinc-400">
        Analyst model: <span className="font-mono">{s.analyst_model}</span>. Agent model:{" "}
        <span className="font-mono">{s.agent_model}</span>. A root cause counts only if both the step and the bug type
        match the mutation log. The PRD target of the diff report being right twice as often as raw logs was{" "}
        {Number(s.b_diff_report_correct) >= 2 * Number(s.b_raw_logs_correct) ? "met" : "not met"}: the demo runs are
        short, so the raw logs are easy to read whole. Steps before each mutation are identical by construction (cached
        model calls), which makes A easier than it would be with a live, varying model.
      </p>

      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-zinc-900 text-xs text-zinc-400">
            <tr>
              <th className="px-3 py-2">Mutation</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Mutated step</th>
              <th className="px-3 py-2">First divergence</th>
              <th className="px-3 py-2">A</th>
              <th className="px-3 py-2">B raw logs</th>
              <th className="px-3 py-2">B diff report</th>
            </tr>
          </thead>
          <tbody>
            {mutations.map((m) => (
              <tr key={m.id} className="border-t border-zinc-800 hover:bg-zinc-900/60" title={m.description}>
                <td className="px-3 py-2 font-mono">{m.id}</td>
                <td className="px-3 py-2 text-zinc-300">{m.type}</td>
                <td className="px-3 py-2 font-mono">{m.mutated_step ?? "-"}</td>
                <td className="px-3 py-2 font-mono">{m.first_divergence ?? "-"}</td>
                <td className="px-3 py-2"><Mark ok={m.match} /></td>
                <td className="px-3 py-2">{b[m.id] ? <Mark ok={b[m.id].raw_logs.correct} /> : "-"}</td>
                <td className="px-3 py-2">{b[m.id] ? <Mark ok={b[m.id].diff_report.correct} /> : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
