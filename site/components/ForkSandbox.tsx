"use client";

import { useState } from "react";
import { StepNum } from "@/components/ui";

export type ForkRun = {
  id: string;
  question: string;
  steps: { index: number; type: string; name: string; tokens: number | null; output: string | null }[];
};

const fmt = (n: number) => n.toLocaleString("en-US");

export function ForkSandbox({ runs }: { runs: ForkRun[] }) {
  const [runIdx, setRunIdx] = useState(0);
  const run = runs[runIdx];
  const toolSteps = run.steps.filter((s) => s.type === "tool");
  const [stepIdx, setStepIdx] = useState(toolSteps[toolSteps.length - 1]?.index ?? 0);
  const recorded = run.steps[stepIdx]?.output ?? "";
  const [value, setValue] = useState(recorded);
  const [forked, setForked] = useState(false);

  function pickRun(i: number) {
    const tools = runs[i].steps.filter((s) => s.type === "tool");
    const last = tools[tools.length - 1];
    setRunIdx(i);
    setStepIdx(last?.index ?? 0);
    setValue(last?.output ?? "");
    setForked(false);
  }
  function pickStep(i: number) {
    setStepIdx(i);
    setValue(run.steps[i].output ?? "");
    setForked(false);
  }

  const unchanged = value === recorded;
  const total = run.steps.reduce((s, x) => s + (x.tokens ?? 0), 0);
  const saved = run.steps.slice(0, stepIdx).reduce((s, x) => s + (x.tokens ?? 0), 0);
  const laterTokens = total - saved;
  const status = (i: number) => (unchanged || i < stepIdx ? "replay" : i === stepIdx ? "edited" : "live");
  const STATUS = {
    replay: ["bg-[#E6F6EA] border-[#3BA55C]", "replayed from the recording · 0 tokens"],
    edited: ["bg-sun border-ink", "your edit · tool not called"],
    live: ["bg-white border-verm border-dashed", "would run live: sees your new value"],
  } as const;

  return (
    <div className="flex flex-col gap-5 rounded-[28px] border-[3px] border-ink bg-white p-[clamp(16px,2.5vw,28px)]">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a run">
        {runs.map((r, i) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={i === runIdx}
            onClick={() => pickRun(i)}
            className={`min-h-11 max-w-full cursor-pointer rounded-2xl border-[3px] border-ink px-4 py-2 text-left text-sm font-bold ${i === runIdx ? "bg-ink text-sun" : "bg-white"}`}
          >
            {r.question}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 font-bold">
          Tool step to edit
          <select
            value={stepIdx}
            onChange={(e) => pickStep(Number(e.target.value))}
            className="min-h-11 max-w-full rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-sm"
          >
            {toolSteps.map((s) => <option key={s.index} value={s.index}>step {s.index} · {s.name}</option>)}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-bold">What the tool returned (edit it)</span>
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); setForked(false); }}
          rows={Math.min(8, Math.max(2, value.split("\n").length))}
          className="w-full rounded-xl border-[3px] border-ink bg-cream p-3 font-mono text-[13px] leading-relaxed"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setForked(true)} className="rt-lift min-h-[52px] cursor-pointer rounded-full border-[3px] border-ink bg-verm px-7 font-bold">
          Fork here
        </button>
        <button type="button" onClick={() => { setValue(recorded); setForked(false); }} className="min-h-[52px] cursor-pointer rounded-full border-[3px] border-ink bg-white px-6 font-bold">
          Reset value
        </button>
      </div>

      {forked && (
        <div role="status" className="flex flex-col gap-4">
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {run.steps.map((s) => {
              const st = status(s.index);
              return (
                <li key={s.index} className={`flex flex-wrap items-center gap-3 rounded-2xl border-[3px] px-3 py-2 ${STATUS[st][0]}`}>
                  <StepNum n={s.index} small active={st === "edited"} />
                  <span className="font-mono text-[13px] font-semibold">{s.type} · {s.name}</span>
                  <span className="text-[13px] sm:ml-auto">{STATUS[st][1]}</span>
                </li>
              );
            })}
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-ink p-4 text-sun">
              <p className="display m-0 text-[34px] leading-none">{unchanged ? fmt(total) : fmt(saved)} tokens</p>
              <p className="m-0 mt-1 text-sm text-white">
                {unchanged
                  ? "saved: nothing changed, so replay serves every step from the recording."
                  : `saved by replaying steps 0–${stepIdx - 1} instead of re-running from scratch (the later steps used ${fmt(laterTokens)} tokens when recorded).`}
              </p>
            </div>
            <pre className="m-0 overflow-auto rounded-2xl bg-paper p-4 font-mono text-[12px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
{`from retrace.replay import fork
with fork("${run.id}", step=${stepIdx},
          edit=lambda output: ${JSON.stringify(value)},
          tools=TOOLS):
    run(${JSON.stringify(run.question)})`}
            </pre>
          </div>
          <p className="m-0 text-sm">
            This page can&apos;t call a model, so it stops at &ldquo;would run live&rdquo;. Run the snippet above locally (see the
            README quickstart) and Retrace replays the early steps for free, then runs the rest live with your edit.
          </p>
        </div>
      )}
    </div>
  );
}
