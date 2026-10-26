import { RunsTable } from "@/components/RunsTable";
import { FREE_TIER_NOTE, ToolShell, fmt } from "@/components/ui";
import { readData, type Index, type Results } from "@/lib/data";

export const metadata = { title: "Runs" };

export default function RunsPage() {
  const { runs } = readData<Index>("index.json");
  const { summary } = readData<Results>("results.json");
  const withFiles = runs.filter((r) => r.has_file).length;
  const stats = [
    { value: runs.length, label: "runs", tone: "bg-ink text-sun", sub: "text-white" },
    { value: fmt(runs.reduce((sum, r) => sum + r.tokens, 0)), label: "tokens in all", tone: "bg-sun", sub: "" },
    { value: runs.filter((r) => r.stopped).length, label: "stopped, no answer", tone: "bg-verm", sub: "" },
  ];

  return (
    <ToolShell current="runs">
      <div className="rt-fade flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <p className="m-0 font-mono text-[13px]">project · brightwater research agent</p>
          <h1 className="display m-0 text-[clamp(48px,5vw,72px)] leading-[0.95]">Runs</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {stats.map((st) => (
            <div key={st.label} className={`flex min-w-[120px] flex-col gap-0.5 rounded-[22px] px-5 py-3.5 ${st.tone}`}>
              <span className="display text-[34px] leading-none">{st.value}</span>
              <span className={`text-[13px] ${st.sub}`}>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="m-0 text-sm">
        Agent: <code className="rounded-lg bg-paper px-2 py-0.5 font-mono text-[13px]">{summary.agent_model}</code>
      </p>

      <RunsTable runs={runs} />

      <p className="m-0 max-w-[80ch] text-sm leading-normal">
        {FREE_TIER_NOTE} Step counts come from each run&apos;s own recording; {withFiles} of {runs.length} runs have their
        steps in this export, the rest are summary only.
      </p>
    </ToolShell>
  );
}
