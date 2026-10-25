import Link from "next/link";
import { RunView } from "@/components/RunView";
import { Badge, H1 } from "@/components/ui";
import { readData, type Index, type Run } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return readData<Index>("index.json").runs.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  return { title: `Run ${id.slice(0, 8)}` };
}

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const meta = readData<Index>("index.json").runs.find((r) => r.id === id)!;
  const run = readData<Run>(`runs/${id}.json`);
  return (
    <>
      <H1
        sub={
          <>
            <span className="text-zinc-300">{meta.question}</span>
            <span className="ml-2 font-mono text-xs">
              {meta.steps} steps · {meta.tokens.toLocaleString("en-US")} tokens · {meta.model}
            </span>
          </>
        }
      >
        <span className="font-mono">run {id.slice(0, 8)}</span> <Badge>{meta.role}</Badge>{" "}
        <Link href={`/diffs/${meta.mutation}`} className="text-sm font-normal text-emerald-400 hover:underline">
          view diff for {meta.mutation} →
        </Link>
      </H1>
      <RunView run={run} />
    </>
  );
}
