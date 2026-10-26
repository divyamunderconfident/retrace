import Link from "next/link";
import { Block, Crumb, FREE_TIER_NOTE, StepNum, ToolShell, fmt } from "@/components/ui";
import { readData, readRun, type Diff, type Index, type Step } from "@/lib/data";
import { shortName, show, stepShort, stepSummary } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return readData<Index>("index.json").diffs.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/diffs/[id]">) {
  const { id } = await params;
  return { title: `Diff: ${id}` };
}

function SamePill({ step }: { step?: Step }) {
  if (!step) return <div className="rounded-full border-2 border-dashed border-[#D9C4A0] px-[18px] py-3 text-sm">no step</div>;
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-full border-2 border-[#D9C4A0] bg-white px-[18px] py-3">
      <StepNum n={step.index} small />
      <span className="truncate font-mono text-sm font-semibold">{shortName(step.name)}</span>
      <span className="hidden text-[13px] sm:inline">{step.type} call · {stepShort(step)}</span>
      <span className="ml-auto rounded-full bg-paper px-2.5 py-0.5 text-xs font-bold">same</span>
    </div>
  );
}

function StepCard({ step, tone }: { step: Step; tone: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[22px] border-[3px] border-ink px-[18px] py-3 ${tone}`}>
      <StepNum n={step.index} small />
      <span className="font-mono text-sm font-semibold">{shortName(step.name)}</span>
      <span className="text-[13px]">{step.type} call · {stepShort(step)}</span>
      <code className="flex-[1_1_100%] rounded-xl bg-cream px-3 py-2 font-mono text-[13px] [overflow-wrap:anywhere]">{stepSummary(step)}</code>
    </div>
  );
}

export default async function DiffPage({ params }: PageProps<"/diffs/[id]">) {
  const { id } = await params;
  const index = readData<Index>("index.json");
  const meta = index.diffs.find((d) => d.id === id)!;
  const d = readData<Diff>(`diffs/${id}.json`);
  const runA = readRun(d.run_a)?.steps ?? [];
  const runB = readRun(d.run_b)?.steps ?? [];
  const metaA = index.runs.find((r) => r.id === d.run_a);
  const metaB = index.runs.find((r) => r.id === d.run_b);
  const fd = d.first_divergence;
  const stepA = fd != null ? runA[fd] : undefined;
  const stepB = fd != null ? runB[fd] : undefined;
  const split = stepA ?? stepB;
  const pct = d.tokens.a ? Math.round((d.tokens.delta / d.tokens.a) * 100) : 0;
  const sign = (x: number) => (x >= 0 ? "+" : "") + fmt(x);
  const answer = (r?: typeof metaA) => (!r ? "" : r.stopped ? "No answer: the run stopped without a final answer." : `“${r.answer}”`);

  // At the split, show what changed on each side; a tool step whose output changed also shows its shared input.
  const side = (which: "a" | "b") =>
    d.changes.map((c) => {
      const value = which === "a" ? c.a : c.b;
      return { label: c.path || "step", text: value === "" ? '"" (empty string)' : show(value) };
    });
  const sharedInput = d.kind === "output" && split?.type === "tool" ? show(split.input) : null;

  return (
    <ToolShell>
      <div className="rt-fade flex flex-col gap-2.5">
        <Crumb>Diff</Crumb>
        <h1 className="display m-0 text-[clamp(40px,4.4vw,64px)] leading-[0.95]">Where did they split?</h1>
        <p className="m-0 max-w-[70ch] text-[17px] leading-normal">
          Same question, &ldquo;{metaA?.question}&rdquo;, two runs. In run B: {meta.description}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
        <div className="rt-lift flex flex-col gap-1.5 rounded-[26px] border-[3px] border-ink bg-verm px-6 py-5">
          <span className="text-[13px] font-bold uppercase tracking-[0.6px]">First divergence</span>
          <span className="display text-[52px] leading-none">{fd == null ? "None" : `Step ${fd}`}</span>
          <span className="text-[15px]">
            {split ? (d.kind === "missing" ? `run ${stepB ? "A" : "B"} has no step ${fd}` : `in the ${d.kind} of ${shortName(split.name)}`) : "the runs are identical"}
          </span>
        </div>
        <div className="rt-lift flex flex-col gap-1.5 rounded-[26px] bg-ink px-6 py-5 text-sun">
          <span className="text-[13px] font-bold uppercase tracking-[0.6px] text-white">Tokens</span>
          <span className="display text-[52px] leading-none">{sign(d.tokens.delta)}</span>
          <span className="text-[15px] tabular-nums text-white">{fmt(d.tokens.a)} → {fmt(d.tokens.b)} · {pct >= 0 ? "+" : ""}{pct}%</span>
        </div>
        <div className="rt-lift flex flex-col gap-1.5 rounded-[26px] border-[3px] border-ink bg-white px-6 py-5">
          <span className="text-[13px] font-bold uppercase tracking-[0.6px]">Steps</span>
          <span className="display text-[52px] leading-none">{d.steps_a} → {d.steps_b}</span>
          <span className="text-[15px]">mutated step: {meta.mutated_step ?? "—"}{meta.mutated_step === fd ? ", matches the diff" : ""}</span>
        </div>
      </div>
      <p className="m-0 -mt-3 text-sm">{FREE_TIER_NOTE}</p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4">
        {[["A · baseline", d.run_a, metaA], [`B · ${meta.type}`, d.run_b, metaB]].map(([label, rid, m]) => (
          <div key={rid as string} className="flex flex-col gap-2.5 rounded-[26px] border-[3px] border-ink bg-white px-[22px] py-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="display text-2xl">{label as string}</span>
              <span className="font-mono text-[13px]">
                {(rid as string).slice(0, 8)} · {d[rid === d.run_a ? "steps_a" : "steps_b"]} steps · {fmt(d.tokens[rid === d.run_a ? "a" : "b"])} tok
              </span>
            </div>
            <p className="m-0 rounded-[14px] bg-paper px-3.5 py-3 font-mono text-sm leading-relaxed">{answer(m as typeof metaA)}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="steps-h" className="flex flex-col gap-3.5">
        <h2 id="steps-h" className="display m-0 text-[32px]">Step by step</h2>

        {fd != null &&
          Array.from({ length: fd }, (_, i) => (
            <div key={i} className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4 opacity-85">
              <SamePill step={runA[i]} />
              <SamePill step={runB[i]} />
            </div>
          ))}

        {fd != null && (
          <div className="rounded-[30px] border-l-[10px] border-verm pl-[clamp(8px,1.4vw,16px)]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
              {(["a", "b"] as const).map((which) => {
                const st = which === "a" ? stepA : stepB;
                const isB = which === "b";
                return (
                  <div
                    key={which}
                    className={`relative flex min-w-0 flex-col gap-3 rounded-[26px] px-[18px] py-4 ${
                      isB ? "border-4 border-verm bg-white outline-[3px] outline-ink outline-solid mt-8 sm:mt-0" : "border-[3px] border-ink bg-sun"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <StepNum n={fd} active={isB} />
                      <span className="font-mono text-[15px] font-semibold">{st ? shortName(st.name) : "—"}</span>
                      <span className="text-[13px]">{st ? `${st.type} call · run ${which.toUpperCase()}` : `no step ${fd} in run ${which.toUpperCase()}`}</span>
                    </div>
                    {sharedInput && <Block label="input · same in both" text={sharedInput} />}
                    {side(which).map((b) => (
                      <Block key={b.label} label={`${b.label} · ${isB ? "differs" : "baseline"}`} text={b.text} alert={isB} className="max-h-[220px]" />
                    ))}
                    {isB && (
                      <div className="rt-bob absolute -top-[30px] right-[18px]">
                        <div className="display whitespace-nowrap bg-ink px-5 py-2.5 text-[22px] text-sun [border-radius:55%_45%_50%_50%/60%_55%_45%_40%]">Here it broke</div>
                        <svg viewBox="0 0 30 22" width="30" height="22" aria-hidden="true" className="absolute bottom-[-16px] left-6">
                          <path d="M4 0c4 10 0 18-4 22C12 18 22 10 24 0z" fill="#2E0E08" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {fd != null && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-start gap-4">
            {[["Run A after the split", runA], ["Run B after the split", runB]].map(([title, steps]) => {
              const rest = (steps as Step[]).slice(fd + 1);
              return (
                <div key={title as string} className="flex min-w-0 flex-col gap-2.5">
                  <h3 className="display m-0 text-[22px]">{title as string}</h3>
                  {rest.length ? rest.map((st) => <StepCard key={st.index} step={st} tone={st.type === "model" ? "bg-white" : "bg-sun"} />)
                    : <p className="m-0 rounded-[22px] border-[3px] border-dashed border-ink bg-paper px-5 py-4 text-[15px]">No more steps.</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <details className="rounded-[22px] border-[3px] border-ink bg-white px-5 py-4">
        <summary className="cursor-pointer font-bold">Plain-text diff report</summary>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-[14px] bg-cream p-3 font-mono text-[13px] [overflow-wrap:anywhere]">{d.report}</pre>
      </details>

      <div className="flex flex-wrap gap-2.5">
        {runA.length > 0 && <Link href={`/runs/${d.run_a}`} className="rt-lift inline-flex min-h-[52px] items-center rounded-full border-[3px] border-ink bg-verm px-6 font-bold no-underline">Open run A</Link>}
        {runB.length > 0 && <Link href={`/runs/${d.run_b}`} className="rt-lift inline-flex min-h-[52px] items-center rounded-full border-[3px] border-ink bg-white px-6 font-bold no-underline">Open run B</Link>}
      </div>
    </ToolShell>
  );
}
