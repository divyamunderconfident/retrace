import Link from "next/link";
import {
  BugContradiction, BugSwallowedError, BugTruncatedContext, BugVagueDescription, BugWrongArgument, CodeIcon,
  DiffIcon, ForkIcon, HowDiff, HowFork, HowRecord, HowReplay, Logo, Mascot, RecordIcon, ReplayIcon,
} from "@/components/art";
import { GITHUB, fmt } from "@/components/ui";
import { readData, type Diff, type Index, type Results, type Run } from "@/lib/data";
import { show } from "@/lib/format";

const BUG_ICONS: Record<string, () => React.ReactElement> = {
  "wrong tool argument": BugWrongArgument,
  "truncated context": BugTruncatedContext,
  "vague tool description": BugVagueDescription,
  "contradicting instruction": BugContradiction,
  "swallowed tool error": BugSwallowedError,
};
const CARD_BG = ["bg-sun", "bg-verm", "bg-white", "bg-verm", "bg-sun"];
const PAD = "px-[clamp(16px,4vw,56px)]";
const WRAP = "mx-auto max-w-[1360px]";
const PILL = "rt-lift inline-flex min-h-14 items-center gap-2.5 rounded-full px-7 text-lg font-bold no-underline";

function Wave({ d, view = "0 0 1440 120", fill, bg, className = "h-[clamp(50px,8vw,120px)]" }: { d: string; view?: string; fill: string; bg?: string; className?: string }) {
  return (
    <svg viewBox={view} preserveAspectRatio="none" aria-hidden="true" className={`-mb-px block w-full ${bg ?? ""} ${className}`}>
      <path d={d} fill={fill} />
    </svg>
  );
}

function SectionHead({ id, title, children, stroke = false }: { id: string; title: string; children: React.ReactNode; stroke?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 id={id} className={`display m-0 text-[clamp(52px,7vw,104px)] leading-[0.9] ${stroke ? "ink-stroke text-sun" : ""}`}>{title}</h2>
      <p className="m-0 max-w-[46ch] text-[17px] leading-normal">{children}</p>
    </div>
  );
}

function Code({ children, bg = "bg-[#FFF7E6]" }: { children: React.ReactNode; bg?: string }) {
  return <code className={`block whitespace-pre-wrap rounded-xl ${bg} px-3 py-2.5 font-mono text-[13px] leading-normal [overflow-wrap:anywhere]`}>{children}</code>;
}

export default function Home() {
  const index = readData<Index>("index.json");
  const { summary: s, mutations, root_cause } = readData<Results>("results.json");
  const rootCause = Object.fromEntries(root_cause.map((r) => [r.id, r]));
  const n = Number(s.b_scored);

  // One card per bug type, with that type's numbers.
  const types = [...new Set(mutations.map((m) => m.type))];
  const cards = types.map((type) => {
    const ms = mutations.filter((m) => m.type === type);
    return {
      type, example: ms[0], total: ms.length,
      found: ms.filter((m) => m.match).length,
      named: ms.filter((m) => rootCause[m.id]?.diff_report.type_correct).length,
    };
  });

  // "How it works" uses one real pair of runs.
  const pair = index.diffs[0];
  const diff = readData<Diff>(`diffs/${pair.id}.json`);
  const runA = readData<Run>(`runs/${pair.run_a}.json`).steps;
  const runB = readData<Run>(`runs/${pair.run_b}.json`).steps;
  const metaA = index.runs.find((r) => r.id === pair.run_a)!;
  const toolStep = runA.find((st) => st.type === "tool" && st.name === "calculator") ?? runA.find((st) => st.type === "tool");
  const fd = diff.first_divergence ?? 0;
  const brokenStep = runB[fd];
  const argsOf = (input: Record<string, unknown>) => Object.values(input).map((v) => JSON.stringify(v)).join(", ");
  const firstRun = `/runs/${pair.run_a}`;

  const bothEqual = s.b_diff_report_correct === s.b_raw_logs_correct;

  return (
    <div className="poster overflow-x-hidden bg-verm">
      <header className={`${PAD} py-5`}>
        <nav aria-label="Main" className={`${WRAP} flex flex-wrap items-center justify-between gap-4`}>
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <Logo />
            <span className="display text-[30px]">Retrace</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-[clamp(12px,2.4vw,32px)] gap-y-2 text-base font-bold">
            <a href="#broke">What broke</a>
            <a href="#how">How it works</a>
            <a href="#results">Results</a>
            <Link href="/try">Try it</Link>
            <Link href="/runs">Runs</Link>
            <a href={GITHUB} className="rt-lift inline-flex min-h-11 items-center rounded-full border-[3px] border-ink bg-white px-5">GitHub</a>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* HERO */}
        <section aria-labelledby="hero-h" className={`relative ${PAD} pt-2`}>
          <div className={`${WRAP} relative z-[1] flex flex-wrap items-start justify-between gap-x-4 gap-y-2`}>
            <div className="rt-fade flex min-w-0 flex-[1_1_340px] flex-col gap-7 pt-2">
              <h1 id="hero-h" className="display ink-stroke m-0 text-[clamp(72px,11vw,166px)] leading-[0.88] text-sun">
                Rewind<br />your<br />agent.
              </h1>
              <p className="m-0 max-w-[30ch] text-lg font-medium leading-normal">
                Retrace records every step your AI agent takes. Replay a run, fork it from any step with an edit, and diff
                two runs to find the first step where they went different.
              </p>
              <div className="flex gap-3">
                {[["Record", RecordIcon], ["Replay", ReplayIcon], ["Fork", ForkIcon], ["Diff", DiffIcon]].map(([label, Icon]) => {
                  const I = Icon as () => React.ReactElement;
                  return (
                    <a key={label as string} href="#how" aria-label={label as string} className="rt-lift flex h-14 w-14 items-center justify-center rounded-full bg-ink">
                      <I />
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="rt-fade-2 mx-auto min-w-0 max-w-[470px] flex-[1_1_360px]">
              <div className="rt-bob"><Mascot /></div>
            </div>

            <div className="rt-fade-3 flex min-w-0 flex-[1_1_320px] flex-col items-end gap-6 text-right">
              <div className="relative mt-3 max-w-[330px]">
                <div className="bg-ink px-8 py-7 text-center text-white [border-radius:58%_42%_52%_48%/50%_56%_44%_50%]">
                  <p className="display m-0 text-[54px] leading-none text-sun">{s.a_matches} of {s.fired}</p>
                  <p className="m-0 mt-2 text-base font-medium leading-snug">broken runs where diff landed on the exact step we broke.</p>
                </div>
                <svg viewBox="0 0 60 40" width="60" height="40" aria-hidden="true" className="absolute bottom-[-28px] left-[34px]">
                  <path d="M8 0C14 18 6 32 0 40 22 34 38 20 44 0z" fill="#2E0E08" />
                </svg>
              </div>
              <p className="display m-0 mt-10 text-[clamp(72px,11vw,166px)] leading-[0.88]">Find<br />the bug.</p>
              <div className="flex flex-wrap justify-end gap-3">
                <Link href="/try" className={`${PILL} bg-ink text-sun`}>Try it yourself</Link>
                <Link href={firstRun} className={`${PILL} box-border border-[3px] border-ink bg-white px-6`}><CodeIcon />See a run</Link>
              </div>
            </div>
          </div>
          <svg viewBox="0 0 1440 170" preserveAspectRatio="none" aria-hidden="true"
               className="-mx-[clamp(16px,4vw,56px)] -mt-[60px] -mb-px block h-[clamp(80px,11vw,170px)] w-[calc(100%+2*clamp(16px,4vw,56px))]">
            <path d="M0 170V96C150 30 330 10 500 64c120 38 220 60 340 30C1000 50 1180 10 1440 80v90z" fill="#2E0E08" />
          </svg>
        </section>

        {/* WHAT BROKE */}
        <section aria-labelledby="broke" className={`bg-ink ${PAD} pt-12 pb-10 text-sun`}>
          <div className={`${WRAP} flex flex-col gap-8`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="broke" className="display m-0 text-[clamp(52px,7vw,104px)] leading-[0.9]">What broke?</h2>
              <p className="m-0 max-w-[46ch] text-[17px] leading-normal text-white">
                We broke one small agent on purpose, {cards[0]?.total ?? 0} ways for each of {cards.length} bug types. Here is one run from each type and
                how often Retrace pointed at the right step.
              </p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(244px,100%),1fr))] gap-[18px]">
              {cards.map((c, i) => {
                const Icon = BUG_ICONS[c.type];
                const m = c.example;
                return (
                  <article key={c.type} className={`rt-lift flex flex-col gap-3.5 rounded-[28px] p-6 text-ink ${CARD_BG[i % CARD_BG.length]}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-base font-bold">0{i + 1}</span>
                      {Icon && <Icon />}
                    </div>
                    <h3 className="display m-0 text-[32px] leading-[0.95]">{c.type}</h3>
                    <p className="m-0 text-[15px] leading-snug">{m.description}</p>
                    <Code>{`step ${m.first_divergence} · ${m.divergence_kind} changed\ntokens ${fmt(m.tokens_correct)} → ${fmt(m.tokens_broken)}`}</Code>
                    <div className="mt-auto flex flex-col gap-1 border-t-[3px] border-dashed border-ink pt-3.5">
                      <p className="display m-0 text-[40px] leading-none">{c.found}/{c.total}</p>
                      <p className="m-0 text-sm leading-snug">
                        diff found the broken step. Analyst named the type {c.named} of {c.total} times from the diff report.
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <Wave bg="bg-ink" fill="#FFDB8E" d="M0 70C200 10 420 0 640 50s480 70 800-20v90H0z" />

        {/* HOW IT WORKS */}
        <section aria-labelledby="how" className={`bg-sun ${PAD} pt-8 pb-14`}>
          <div className={`${WRAP} flex flex-col gap-10`}>
            <SectionHead id="how" title="How it works">One real run, start to finish: &ldquo;{metaA.question}&rdquo;</SectionHead>
            <div className="relative">
              <svg viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" className="absolute top-[34px] left-0 z-0 h-20 w-full">
                <path d="M0 40C120 0 240 80 360 40s240-80 360 0 240 80 360 0 240-80 360 0" fill="none" stroke="#2E0E08" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 16" />
              </svg>
              <ol className="relative z-[1] m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6 p-0">
                {[
                  { Icon: HowRecord, title: "Record", body: "Every model call and tool call is saved with its input, output, tokens and latency.",
                    code: `run ${metaA.id.slice(0, 8)}\n${metaA.steps} steps · ${fmt(metaA.tokens)} tokens` },
                  { Icon: HowReplay, title: "Replay", body: "Step through the run as it happened and open any step's exact input and output.",
                    code: toolStep ? `step ${toolStep.index} · ${toolStep.name}\n${argsOf(toolStep.input)} → ${JSON.stringify(show(toolStep.output)).slice(0, 60)}` : "" },
                  { Icon: HowFork, title: "Fork", body: "Pick a step, change its input or output, and let the agent carry on from there.",
                    code: brokenStep ? `edit @ step ${fd}\n${brokenStep.name}(${argsOf(brokenStep.input)}) → ${JSON.stringify(show(brokenStep.output)).slice(0, 40)}` : "" },
                  { Icon: HowDiff, title: "Diff", body: "Line two runs up side by side and jump to the first step where they went different.",
                    code: `first divergence: step ${fd}\n${diff.kind} · ${diff.tokens.delta >= 0 ? "+" : ""}${fmt(diff.tokens.delta)} tokens` },
                ].map(({ Icon, title, body, code }, i) => (
                  <li key={title} className="rt-lift flex flex-col gap-3.5 rounded-[32px] border-4 border-ink bg-white p-6">
                    <Icon />
                    <p className="m-0 text-[15px] font-bold">Step {i + 1}</p>
                    <h3 className="display m-0 text-[44px] leading-[0.95]">{title}</h3>
                    <p className="m-0 text-base leading-normal">{body}</p>
                    <Code bg="bg-code">{code}</Code>
                  </li>
                ))}
              </ol>
            </div>
            <p className="m-0 text-sm">
              <Link href={`/diffs/${pair.id}`} className="font-bold underline">Open this diff</Link> to see both runs step by step.
            </p>
          </div>
        </section>
        <Wave bg="bg-sun" fill="#E8603A" d="M0 40c260 70 520 80 780 30S1240 0 1440 60v60H0z" />

        {/* RESULTS */}
        <section aria-labelledby="results" className={`bg-verm ${PAD} pt-8 pb-[72px]`}>
          <div className={`${WRAP} flex flex-col gap-9`}>
            <SectionHead id="results" title="The results" stroke>
              {s.mutations} injected bugs, {s.fired} fired. For each, an analyst model tried to name the broken step and bug
              type, once from raw logs and once from Retrace&apos;s diff report.
            </SectionHead>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
              <div className="rt-lift flex flex-col gap-2.5 rounded-[36px] bg-ink p-8 text-sun">
                <p className="display m-0 text-[clamp(80px,9vw,132px)] leading-[0.9]">{s.a_matches}/{s.fired}</p>
                <p className="m-0 text-[17px] leading-snug text-white">times the first divergence landed exactly on the step we broke.</p>
              </div>
              <div className="rt-lift flex flex-col gap-2.5 rounded-[36px] bg-sun p-8">
                <p className="display m-0 text-[clamp(80px,9vw,132px)] leading-[0.9]">{s.b_diff_report_step_correct}/{n}</p>
                <p className="m-0 text-[17px] leading-snug">
                  right step named by the analyst with the diff report, against {s.b_raw_logs_step_correct}/{n} from raw logs.
                </p>
              </div>
              <div className="rt-lift flex flex-col gap-2.5 rounded-[36px] bg-white p-8">
                <p className="display m-0 text-[clamp(80px,9vw,132px)] leading-[0.9]">
                  {bothEqual ? `${s.b_diff_report_correct}/${n}` : `${s.b_diff_report_correct} vs ${s.b_raw_logs_correct}`}
                </p>
                <p className="m-0 text-[17px] leading-snug">
                  {bothEqual
                    ? "right step and right bug type, from the diff report and from raw logs alike."
                    : `right step and right bug type out of ${n}: diff report vs raw logs.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <p className="m-0 max-w-full self-start rounded-2xl bg-code px-4 py-3 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]">
                agent: {s.agent_model} · analyst: {s.analyst_model}
              </p>
              <Link href="/results" className="font-bold underline">Full results table</Link>
            </div>
          </div>
        </section>
        <Wave bg="bg-verm" fill="#2E0E08" d="M0 80C180 20 400 10 620 60s520 60 820-30v90H0z" />
      </main>

      <footer className={`bg-ink ${PAD} pt-6 pb-12 text-sun`}>
        <div className={`${WRAP} flex flex-wrap items-end justify-between gap-8`}>
          <p className="display m-0 max-w-[12ch] text-[clamp(48px,6.5vw,96px)] leading-[0.92]">Your next bug is one fork away.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/try" className={`${PILL} bg-verm text-ink`}>Try it yourself</Link>
            <a href={GITHUB} className={`${PILL} bg-sun text-ink`}>GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
