"use client";

import { useState } from "react";
import { Block, StepNum } from "@/components/ui";
import type { Run } from "@/lib/data";
import { inputBlocks, outputBlocks, outputNote, shortName, stepMeta, stepShort } from "@/lib/format";

function Panel({ title, note, head, children }: { title: string; note: string; head: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border-[3px] border-ink bg-paper">
      <div className={`flex items-center justify-between border-b-[3px] border-ink px-5 py-3 ${head}`}>
        <h3 className="display m-0 text-[22px]">{title}</h3>
        <span className="text-[13px] font-bold">{note}</span>
      </div>
      <div className="flex max-h-[520px] flex-col gap-3.5 overflow-auto px-5 py-4">{children}</div>
    </div>
  );
}

export function RunView({ run }: { run: Run }) {
  const [selected, setSelected] = useState(0);
  const steps = run.steps;
  const step = steps[selected];
  const input = inputBlocks(step);
  const output = outputBlocks(step);
  const arrow = (d: string) => <path d={d} fill="none" stroke="#FFDB8E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
  const nav = "rt-lift flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-ink disabled:cursor-default disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-start gap-7">
      <aside aria-label="Step timeline" className="flex min-w-0 max-w-[340px] flex-[1_1_260px] flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="display m-0 text-[26px]">Timeline</h2>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous step" disabled={selected === 0} onClick={() => setSelected(selected - 1)} className={nav}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{arrow("M15 5l-7 7 7 7")}</svg>
            </button>
            <button type="button" aria-label="Next step" disabled={selected === steps.length - 1} onClick={() => setSelected(selected + 1)} className={nav}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{arrow("M9 5l7 7-7 7")}</svg>
            </button>
          </div>
        </div>
        <ol className="m-0 flex list-none flex-col p-0">
          {steps.map((st, i) => {
            const on = i === selected;
            return (
              <li key={st.index} className="flex flex-col">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(i)}
                  className={`flex min-h-16 w-full cursor-pointer items-center gap-3.5 rounded-full border-[3px] border-ink py-2.5 pr-4 pl-3 text-left transition-transform ${
                    on ? "translate-x-1.5 bg-ink text-sun" : st.type === "model" ? "bg-white" : "bg-sun"
                  }`}
                >
                  <StepNum n={st.index} active={on} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-sm font-semibold [overflow-wrap:anywhere]">{shortName(st.name)}</span>
                    <span className="text-[13px]">{st.type === "model" ? "model call" : "tool call"} · {stepShort(st)}</span>
                  </span>
                </button>
                {i < steps.length - 1 && <span aria-hidden="true" className="ml-[39px] block h-[18px] border-l-4 border-dotted border-ink" />}
              </li>
            );
          })}
        </ol>
        <p className="m-0 text-[13px] leading-normal">White chips are model calls, cream chips are tool calls.</p>
      </aside>

      <section aria-label="Selected step" key={selected} className="rt-fade flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
          <h2 className="display m-0 text-[clamp(30px,3vw,42px)]">
            Step {step.index} · <span className="font-mono text-[0.6em] normal-case">{shortName(step.name)}</span>
          </h2>
          <p className="m-0 font-mono text-[13px] leading-normal">{stepMeta(step)}</p>
        </div>
        <Panel title="Input" head="bg-sun" note={input.length === 1 ? "1 block" : `${input.length} blocks`}>
          {input.map((b, i) => <Block key={i} label={b.label} text={b.text} />)}
        </Panel>
        <Panel title="Output" head="bg-verm" note={outputNote(step)}>
          {output.length ? output.map((b, i) => <Block key={i} label={b.label} text={b.text} />) : <p className="m-0 text-sm">Empty output.</p>}
        </Panel>
      </section>
    </div>
  );
}
