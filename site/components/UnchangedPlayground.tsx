"use client";

import { useEffect, useMemo, useState } from "react";
import { stepFingerprint } from "@/lib/fingerprint";

export type PlayStep = { index: number; type: string; name: string; input: unknown };

export function UnchangedPlayground({ steps, runId }: { steps: PlayStep[]; runId: string }) {
  const [idx, setIdx] = useState(steps.find((s) => s.type === "tool")?.index ?? 0);
  const step = steps[idx];
  const original = JSON.stringify(step.input, null, 2);
  const [text, setText] = useState(original);
  const [recorded, setRecorded] = useState("");
  const [current, setCurrent] = useState("");
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false as const }; // not valid JSON yet
    }
  }, [text]);

  useEffect(() => {
    stepFingerprint(step.type, step.name, step.input).then(setRecorded);
  }, [step]);

  useEffect(() => {
    if (!parsed.ok) return;
    let live = true;
    stepFingerprint(step.type, step.name, parsed.value).then((h) => live && setCurrent(h));
    return () => { live = false; };
  }, [parsed, step]);

  const invalid = !parsed.ok;
  const match = !invalid && current !== "" && current === recorded;

  return (
    <div className="flex flex-col gap-5 rounded-[28px] border-[3px] border-ink bg-white p-[clamp(16px,2.5vw,28px)]">
      <label className="flex max-w-full flex-col gap-1.5 self-start font-bold">
        Step of run {runId.slice(0, 8)}
        <select
          value={idx}
          onChange={(e) => { const i = Number(e.target.value); setIdx(i); setText(JSON.stringify(steps[i].input, null, 2)); }}
          className="min-h-11 max-w-full rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-sm"
        >
          {steps.map((s) => <option key={s.index} value={s.index}>step {s.index} · {s.type} · {s.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-bold">The step&apos;s input (edit anything, even one character)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={step.type === "tool" ? 4 : 14}
          className="w-full rounded-xl border-[3px] border-ink bg-cream p-3 font-mono text-[13px] leading-relaxed"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl bg-paper p-4">
          <p className="m-0 text-[13px] font-bold uppercase tracking-[0.6px]">Recorded fingerprint</p>
          <p className="m-0 mt-1 font-mono text-[13px] [overflow-wrap:anywhere]">{recorded || "…"}</p>
          <p className="m-0 mt-3 text-[13px] font-bold uppercase tracking-[0.6px]">Fingerprint of your input</p>
          <p className="m-0 mt-1 font-mono text-[13px] [overflow-wrap:anywhere]">{invalid ? "not valid JSON yet" : current || "…"}</p>
        </div>
        <div
          role="status"
          className={`flex flex-col justify-center gap-1 rounded-2xl border-[3px] p-4 ${match ? "border-[#3BA55C] bg-[#E6F6EA]" : "border-verm bg-white"}`}
        >
          <p className="display m-0 text-[30px] leading-none">{match ? "Unchanged" : invalid ? "Invalid JSON" : "Changed"}</p>
          <p className="m-0 text-sm">
            {match
              ? "Matches the recording: replay serves this step's saved output. No model or tool call, 0 tokens."
              : invalid
                ? "Fix the JSON to see its fingerprint."
                : "No recorded step has this fingerprint, so replay can't serve it: this step (and everything after it) would run live."}
          </p>
          {text !== original && (
            <button type="button" onClick={() => setText(original)} className="mt-2 min-h-10 cursor-pointer self-start rounded-full border-2 border-ink bg-white px-4 text-sm font-bold">
              Undo my edits
            </button>
          )}
        </div>
      </div>
      <p className="m-0 text-sm">
        The fingerprint is SHA-256 over the step&apos;s type, name and input, computed in your browser exactly the way Retrace
        computes it in Python (a test checks they match). Whitespace in the box doesn&apos;t matter; the JSON&apos;s content does.
      </p>
    </div>
  );
}
