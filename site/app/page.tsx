import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Badge } from "@/components/ui";
import { readData, type Diff, type Index, type Results, type Run, type Step } from "@/lib/data";
import { stepSummary } from "@/lib/format";

const HOW = [
  { title: "Record", body: "Wrap your model client and tools in two lines. Every step's input, output, tokens and latency go to SQLite." },
  { title: "Replay", body: "Steps whose input hash matches the recording are served from it: zero tokens, byte-identical output." },
  { title: "Fork", body: "Edit a tool result, a message or the system prompt at step N and re-run live from there. Side effects never repeat." },
  { title: "Diff", body: "Line up two runs and get the first step where they split, the exact fields that changed, and the token delta." },
];

function StripRow({ i, a, b, split }: { i: number; a?: Step; b?: Step; split: boolean }) {
  const cell = (s?: Step) => (
    <div className={`min-w-0 font-mono text-[11px] sm:text-xs ${split ? "break-words" : "truncate"}`}>
      {s ? <><span className={s.type === "tool" ? "text-violet-300" : "text-sky-300"}>{s.type}</span> {stepSummary(s)}</> : "-"}
    </div>
  );
  return (
    <div className={`grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-2 ${split ? "bg-amber-950/40 ring-1 ring-inset ring-amber-600/70" : "text-zinc-500"}`}>
      <div className={`font-mono text-[11px] ${split ? "text-amber-300" : ""}`}>{split ? "split" : i}</div>
      <div className={split ? "text-zinc-200" : ""}>{cell(a)}</div>
      <div className={split ? "text-zinc-200" : ""}>{cell(b)}</div>
    </div>
  );
}

function SplitPreview({ diffId }: { diffId: string }) {
  const d = readData<Diff>(`diffs/${diffId}.json`);
  const a = readData<Run>(`runs/${d.run_a}.json`).steps;
  const b = readData<Run>(`runs/${d.run_b}.json`).steps;
  const fd = d.first_divergence ?? 0;
  const rows = [fd - 2, fd - 1, fd, fd + 1].filter((i) => i >= 0 && (i < a.length || i < b.length));
  return (
    <Link
      href={`/diffs/${diffId}`}
      className="group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-2xl shadow-black/40 transition hover:border-zinc-700"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
        <span className="font-mono">diff · {diffId}</span>
        <span className="text-emerald-400 transition group-hover:translate-x-0.5">open →</span>
      </div>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-1.5 text-[11px] text-zinc-500">
        <span>#</span><span>a · correct</span><span>b · broken</span>
      </div>
      {rows.map((i) => <StripRow key={i} i={i} a={a[i]} b={b[i]} split={i === fd} />)}
    </Link>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal className="mt-16 sm:mt-20">
      <section id={id} aria-labelledby={`${id ?? title}-h`} className="scroll-mt-20">
        <h2 id={`${id ?? title}-h`} className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
        {children}
      </section>
    </Reveal>
  );
}

export default function Home() {
  const { runs, diffs } = readData<Index>("index.json");
  const { summary: s } = readData<Results>("results.json");

  return (
    <>
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-10">
        <div>
          <p className="rise font-mono text-xs text-emerald-400">time-travel debugging for AI agents</p>
          <h1 className="rise rise-1 mt-3 text-3xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
            Find the step where your agent went wrong.
          </h1>
          <p className="rise rise-2 mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Retrace records every step of a plain SDK agent loop, replays unchanged steps for free, forks a run at any
            step with an edit, and diffs two runs to show exactly where they split.
          </p>
          <div className="rise rise-3 mt-6 flex flex-wrap gap-3">
            <Link href={`/diffs/${diffs[0].id}`} className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-zinc-950 transition hover:bg-emerald-400">
              See a diff
            </Link>
            <Link href="/results" className="rounded-lg border border-zinc-700 px-4 py-2 font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900">
              Read the results
            </Link>
          </div>
          <dl className="rise rise-3 mt-8 grid max-w-xl grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <dt className="text-xs text-zinc-500">Diff found the seeded bug&apos;s step</dt>
              <dd className="mt-1 font-mono text-2xl text-zinc-50">{s.a_matches} / {s.fired}</dd>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <dt className="text-xs text-zinc-500">Root cause right: raw logs vs diff</dt>
              <dd className="mt-1 font-mono text-2xl text-zinc-50">{s.b_raw_logs_correct} vs {s.b_diff_report_correct}</dd>
            </div>
          </dl>
        </div>
        <div className="rise rise-2 min-w-0">
          <SplitPreview diffId={diffs[0].id} />
          <p className="mt-2 text-xs text-zinc-500">A real recorded pair of runs. Seeded bug: {diffs[0].description}</p>
        </div>
      </section>

      <Section title="How it works">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((h, i) => (
            <div key={h.title} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/60">
              <div className="font-mono text-xs text-zinc-500">0{i + 1}</div>
              <h3 className="mt-1 font-medium text-zinc-100">{h.title}</h3>
              <p className="mt-1.5 leading-relaxed text-zinc-400">{h.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="diffs" title="Diffs: seeded bug vs correct run">
        <div className="grid gap-3 md:grid-cols-3">
          {diffs.map((d) => (
            <Link
              key={d.id}
              href={`/diffs/${d.id}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/60"
            >
              <div className="font-mono text-emerald-400">{d.id}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{d.type}</div>
              <p className="mt-2 leading-relaxed text-zinc-400">{d.description}</p>
              <div className="mt-3 flex gap-4 font-mono text-xs text-zinc-300">
                <span>split at step {d.first_divergence}</span>
                <span className="text-zinc-500">{d.kind} changed</span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="runs" title="Recorded runs">
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-900/80 text-xs text-zinc-400">
              <tr>
                <th scope="col" className="px-3 py-2">Run</th>
                <th scope="col" className="hidden px-3 py-2 md:table-cell">Question</th>
                <th scope="col" className="px-3 py-2 text-right">Steps</th>
                <th scope="col" className="px-3 py-2 text-right">Tokens</th>
                <th scope="col" className="hidden px-3 py-2 lg:table-cell">Answer</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800 align-top transition-colors hover:bg-zinc-900/60">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/runs/${r.id}`} className="font-mono text-emerald-400 hover:underline">{r.id.slice(0, 8)}</Link>
                      <Badge>{r.role}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{r.mutation}</div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-zinc-300 md:table-cell">{r.question}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.steps}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.tokens.toLocaleString("en-US")}</td>
                  <td className="hidden max-w-xs px-3 py-2.5 text-zinc-400 lg:table-cell">{r.answer.slice(0, 140)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
