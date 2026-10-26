import { ToolShell } from "@/components/ui";
import { readData, type Results } from "@/lib/data";

export const metadata = { title: "Results" };

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-0.5 text-[13px] font-bold ${ok ? "border-2 border-ink bg-white" : "bg-verm"}`}>
      {ok ? "yes" : "no"}
    </span>
  );
}

export default function ResultsPage() {
  const { summary: s, mutations, root_cause } = readData<Results>("results.json");
  const b = Object.fromEntries(root_cause.map((r) => [r.id, r]));
  const n = Number(s.b_scored);
  const targetMet = Number(s.b_diff_report_correct) >= 2 * Number(s.b_raw_logs_correct);
  const stats = [
    { value: `${s.a_matches}/${s.fired}`, label: "diff's first divergence was the mutated step", tone: "bg-ink text-sun", sub: "text-white" },
    { value: `${s.b_raw_logs_correct}/${n}`, label: `root cause from raw JSON logs (step right ${s.b_raw_logs_step_correct}, type right ${s.b_raw_logs_type_correct})`, tone: "bg-white border-[3px] border-ink", sub: "" },
    { value: `${s.b_diff_report_correct}/${n}`, label: `root cause from the diff report (step right ${s.b_diff_report_step_correct}, type right ${s.b_diff_report_type_correct})`, tone: "bg-sun", sub: "" },
  ];

  return (
    <ToolShell current="results">
      <div className="rt-fade flex flex-col gap-2.5">
        <p className="m-0 font-mono text-[13px]">small mutation experiment</p>
        <h1 className="display m-0 text-[clamp(48px,5vw,72px)] leading-[0.95]">Results</h1>
        <p className="m-0 max-w-[70ch] text-[17px] leading-normal">
          {s.mutations} seeded bugs in the demo agent, 2 for each of 5 bug types, one trial each. Numbers come from
          results/ in the repo.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
        {stats.map((st) => (
          <div key={st.label} className={`rt-lift flex flex-col gap-2 rounded-[30px] px-7 py-6 ${st.tone}`}>
            <span className="display text-[clamp(64px,7vw,96px)] leading-[0.9]">{st.value}</span>
            <span className={`text-[15px] leading-snug ${st.sub}`}>{st.label}</span>
          </div>
        ))}
      </div>

      <p className="m-0 max-w-[80ch] text-[15px] leading-relaxed">
        Analyst model: <code className="rounded-md bg-paper px-1.5 font-mono text-[13px]">{s.analyst_model}</code>. Agent model:{" "}
        <code className="rounded-md bg-paper px-1.5 font-mono text-[13px]">{s.agent_model}</code>. A root cause counts only if both the
        step and the bug type match the mutation log. The PRD target of the diff report being right twice as often as raw
        logs was <strong>{targetMet ? "met" : "not met"}</strong>: the demo runs are short, so the raw logs are easy to read whole.
        Steps before each mutation are identical by construction (cached model calls), which makes A easier than it would
        be with a live, varying model.
      </p>

      <div className="overflow-hidden rounded-[28px] border-[3px] border-ink bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-ink text-left text-[13px] uppercase tracking-[0.6px] text-sun">
                <th scope="col" className="px-5 py-3.5">Mutation</th>
                <th scope="col" className="px-3 py-3.5">Type</th>
                <th scope="col" className="px-3 py-3.5 text-right">Mutated step</th>
                <th scope="col" className="px-3 py-3.5 text-right">First divergence</th>
                <th scope="col" className="px-3 py-3.5">A</th>
                <th scope="col" className="px-3 py-3.5">B raw logs</th>
                <th scope="col" className="px-3 py-3.5 pr-5">B diff report</th>
              </tr>
            </thead>
            <tbody>
              {mutations.map((m) => (
                <tr key={m.id} title={m.description} className="border-t-2 border-rule hover:bg-paper">
                  <td className="px-5 py-3 font-mono text-[13px]">{m.id}</td>
                  <td className="px-3 py-3">{m.type}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{m.mutated_step ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{m.first_divergence ?? "—"}</td>
                  <td className="px-3 py-3"><Mark ok={m.match} /></td>
                  <td className="px-3 py-3">{b[m.id] ? <Mark ok={b[m.id].raw_logs.correct} /> : "—"}</td>
                  <td className="px-3 py-3 pr-5">{b[m.id] ? <Mark ok={b[m.id].diff_report.correct} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ToolShell>
  );
}
