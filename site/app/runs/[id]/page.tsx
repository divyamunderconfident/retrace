import Link from "next/link";
import { RunView } from "@/components/RunView";
import { Chip, Crumb, FREE_TIER_NOTE, ToolShell, fmt } from "@/components/ui";
import { readData, type Index, type Run } from "@/lib/data";

export const dynamicParams = false;

// Only runs whose step file is exported get a page; the others are summary only in the runs list.
export function generateStaticParams() {
  return readData<Index>("index.json").runs.filter((r) => r.has_file).map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  return { title: `Run ${id.slice(0, 8)}` };
}

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const index = readData<Index>("index.json");
  const meta = index.runs.find((r) => r.id === id)!;
  const run = readData<Run>(`runs/${id}.json`);
  const pair = index.diffs.find((d) => d.run_a === id || d.run_b === id);
  const other = pair && (pair.run_a === id ? pair.run_b : pair.run_a);
  const modelCalls = run.steps.filter((s) => s.type === "model").length;
  const tokens = run.steps.reduce((sum, s) => sum + (s.tokens ?? 0), 0);

  return (
    <ToolShell>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
          <Crumb><span className="font-mono font-normal [overflow-wrap:anywhere]">{id}</span></Crumb>
          <h1 className="display m-0 max-w-[26ch] text-[clamp(32px,3.6vw,52px)] leading-none">{meta.question}</h1>
          <div className="flex flex-wrap gap-2">
            <Chip tone={meta.stopped ? "verm" : "white"}>{meta.stopped ? "Stopped" : "Answered"}</Chip>
            <Chip>{run.steps.length} steps</Chip>
            <Chip>{fmt(tokens)} tokens</Chip>
            <Chip tone="paper" mono>{meta.model}</Chip>
            <Chip tone="ink">
              {meta.stopped ? `No answer: stopped after ${modelCalls} model calls` : `Answer: “${meta.answer}”`}
            </Chip>
          </div>
        </div>
        {pair && other && (
          <Link href={`/diffs/${pair.id}`} className="rt-lift inline-flex min-h-[52px] items-center rounded-full bg-ink px-6 text-base font-bold text-sun no-underline">
            Diff with {other.slice(0, 8)}
          </Link>
        )}
      </div>
      <RunView run={run} />
      <p className="m-0 text-sm">{FREE_TIER_NOTE}</p>
    </ToolShell>
  );
}
