"use client";

import Link from "next/link";
import { useState } from "react";
import { StepNum } from "@/components/ui";

export type Round = {
  diffId: string;
  question: string;
  correctAnswer: string;
  brokenAnswer: string;
  type: string;
  mutatedStep: number;
  steps: { index: number; type: string; name: string; summary: string }[];
  changes: { path: string; a: string; b: string }[];
};

export function FindTheBug({ rounds, types }: { rounds: Round[]; types: string[] }) {
  const [round, setRound] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState<boolean[]>([]);
  const r = rounds[round];
  const stepRight = step === r.mutatedStep;
  const typeRight = type === r.type;
  const done = score.length === rounds.length && checked && round === rounds.length - 1;

  function check() {
    setChecked(true);
    setScore([...score, stepRight && typeRight]);
  }
  function next() {
    if (round === rounds.length - 1) {
      setRound(0);
      setScore([]);
    } else setRound(round + 1);
    setStep(null);
    setType(null);
    setChecked(false);
  }

  return (
    <div className="flex flex-col gap-5 rounded-[28px] border-[3px] border-ink bg-white p-[clamp(16px,2.5vw,28px)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold">Round {round + 1} of {rounds.length}</span>
        <span className="flex gap-1.5" aria-label={`Score: ${score.filter(Boolean).length} of ${score.length}`}>
          {rounds.map((_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink ${i >= score.length ? "bg-white" : score[i] ? "bg-[#3BA55C]" : "bg-verm"}`} />
          ))}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-paper p-4">
          <p className="m-0 text-[13px] font-bold uppercase tracking-[0.6px]">Question</p>
          <p className="m-0 mt-1 text-[17px] leading-snug">{r.question}</p>
        </div>
        <div className="grid gap-2">
          <p className="m-0 rounded-2xl bg-cream px-4 py-2.5 text-sm"><b>Healthy run said:</b> {r.correctAnswer}</p>
          <p className="m-0 rounded-2xl border-2 border-dashed border-verm bg-cream px-4 py-2.5 text-sm"><b>Broken run said:</b> {r.brokenAnswer}</p>
        </div>
      </div>

      <fieldset className="m-0 min-w-0 border-0 p-0" disabled={checked}>
        <legend className="mb-2 font-bold">1. Which step of the broken run went wrong?</legend>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {r.steps.map((s) => {
            const picked = step === s.index;
            const reveal = checked && s.index === r.mutatedStep;
            return (
              <li key={s.index}>
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setStep(s.index)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-[3px] px-3 py-2 text-left disabled:cursor-default ${
                    reveal ? "border-[#3BA55C] bg-[#E6F6EA]" : picked ? "border-ink bg-sun" : "border-rule bg-white hover:border-ink"
                  }`}
                >
                  <StepNum n={s.index} small active={picked} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px] font-semibold">{s.type} · {s.name}</span>
                    <span className="block truncate font-mono text-xs">{s.summary}</span>
                  </span>
                  {reveal && <span className="text-xs font-bold">broke here</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </fieldset>

      <fieldset className="m-0 min-w-0 border-0 p-0" disabled={checked}>
        <legend className="mb-2 font-bold">2. What kind of bug is it?</legend>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`min-h-11 cursor-pointer rounded-full border-[3px] px-4 text-sm font-bold disabled:cursor-default ${
                checked && t === r.type ? "border-[#3BA55C] bg-[#E6F6EA]" : type === t ? "border-ink bg-ink text-sun" : "border-ink bg-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      {!checked ? (
        <button
          type="button"
          onClick={check}
          disabled={step === null || type === null}
          className="rt-lift min-h-[52px] cursor-pointer self-start rounded-full border-[3px] border-ink bg-verm px-7 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Check my answer
        </button>
      ) : (
        <div role="status" className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-sun">
          <p className="display m-0 text-[30px] leading-none">
            {stepRight && typeRight ? "Nailed it." : stepRight || typeRight ? "Half right." : "Not quite."}
          </p>
          <p className="m-0 text-white">
            Step: {stepRight ? "right" : `it was step ${r.mutatedStep}`}. Bug type: {typeRight ? "right" : `it was “${r.type}”`}.
            Retrace&apos;s diff finds this split instantly by lining the broken run up against the healthy one:
          </p>
          <div className="flex flex-col gap-2">
            {r.changes.map((c) => (
              <div key={c.path} className="rounded-xl bg-cream p-3 font-mono text-[13px] text-ink [overflow-wrap:anywhere]">
                <b>step {r.mutatedStep} · {c.path}</b>
                <br />healthy: {c.a}
                <br />broken: {c.b}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={next} className="rt-lift min-h-11 cursor-pointer rounded-full bg-sun px-5 font-bold text-ink">
              {done ? "Play again" : "Next round"}
            </button>
            <Link href={`/diffs/${r.diffId}`} className="inline-flex min-h-11 items-center rounded-full border-2 border-sun px-5 font-bold text-sun">
              Open the full diff
            </Link>
          </div>
          {done && <p className="m-0 font-bold">You got {score.filter(Boolean).length} of {rounds.length} fully right.</p>}
        </div>
      )}
    </div>
  );
}
