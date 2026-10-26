import { FindTheBug, type Round } from "@/components/FindTheBug";
import { ForkSandbox, type ForkRun } from "@/components/ForkSandbox";
import { UnchangedPlayground } from "@/components/UnchangedPlayground";
import { ToolShell } from "@/components/ui";
import { readData, readRun, type Diff, type Index, type Results } from "@/lib/data";
import { show, stepSummary } from "@/lib/format";

export const metadata = { title: "Try it" };

const clip = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n)}…` : s);

function Section({ n, title, intro, children }: { n: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`try-${n}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`try-${n}`} className="display m-0 text-[clamp(34px,4vw,56px)] leading-[0.95]">
          <span className="mr-3 text-verm">{n}</span>{title}
        </h2>
        <p className="m-0 max-w-[52ch] text-[16px] leading-normal">{intro}</p>
      </div>
      {children}
    </section>
  );
}

export default function TryPage() {
  const index = readData<Index>("index.json");
  const { mutations } = readData<Results>("results.json");
  const types = [...new Set(mutations.map((m) => m.type))];
  const answerOf = (id: string) => {
    const r = index.runs.find((x) => x.id === id);
    return !r ? "" : r.stopped ? "(no answer: it gave up after hitting the step limit)" : `“${r.answer}”`;
  };

  const rounds: Round[] = index.diffs.flatMap((d) => {
    const broken = readRun(d.run_b);
    if (!broken || d.mutated_step == null) return [];
    const diff = readData<Diff>(`diffs/${d.id}.json`);
    return [{
      diffId: d.id,
      question: index.runs.find((r) => r.id === d.run_a)?.question ?? "",
      correctAnswer: answerOf(d.run_a),
      brokenAnswer: answerOf(d.run_b),
      type: d.type,
      mutatedStep: d.mutated_step,
      steps: broken.steps.map((s) => ({ index: s.index, type: s.type, name: s.name, summary: stepSummary(s) })),
      changes: diff.changes.slice(0, 3).map((c) => ({ path: c.path, a: clip(show(c.a)), b: clip(show(c.b === "" ? '""' : c.b)) })),
    }];
  });

  const healthy = index.runs.filter((r) => r.role === "correct" && r.has_file);
  const forkRuns: ForkRun[] = healthy.flatMap((meta) => {
    const run = readRun(meta.id);
    return run ? [{
      id: meta.id,
      question: meta.question,
      steps: run.steps.map((s) => ({
        index: s.index, type: s.type, name: s.name, tokens: s.tokens,
        output: s.type === "tool" ? show(s.output) : null,
      })),
    }] : [];
  });
  const playRun = readRun(healthy[0].id)!;

  return (
    <ToolShell current="try">
      <div className="rt-fade flex flex-col gap-3">
        <p className="m-0 font-mono text-[13px]">hands-on · runs in your browser on recorded runs · no AI calls</p>
        <h1 className="display m-0 text-[clamp(48px,5.5vw,80px)] leading-[0.92]">Try it yourself</h1>
        <p className="m-0 max-w-[70ch] text-[17px] leading-normal">
          Three short exercises with real recordings of the demo agent. Find a bug the way you would with logs, fork a run
          the way you would with Retrace, then see how Retrace decides a step is unchanged.
        </p>
      </div>

      <Section n="A" title="Find the bug" intro="An agent gave a wrong answer. Look at its steps, pick the one that broke and the kind of bug, then see how Retrace's diff points straight at it.">
        <FindTheBug rounds={rounds} types={types} />
      </Section>

      <Section n="B" title="Fork it yourself" intro="Change what a tool returned at one step. Retrace replays everything before it for free and only re-runs what comes after.">
        <ForkSandbox runs={forkRuns} />
      </Section>

      <Section n="C" title="Is this step unchanged?" intro="Replay serves a step from the recording only if its fingerprint matches. Edit the input and watch it stop matching.">
        <UnchangedPlayground
          runId={playRun.run_id}
          steps={playRun.steps.map((s) => ({ index: s.index, type: s.type, name: s.name, input: s.input }))}
        />
      </Section>
    </ToolShell>
  );
}
