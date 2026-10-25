"use client";

import { useState } from "react";
import { Badge, Json } from "@/components/ui";
import type { Run, Step } from "@/lib/data";
import { stepSummary, type Message } from "@/lib/format";

function MessageBlock({ m, isNew }: { m: Message; isNew: boolean }) {
  return (
    <div className={`rounded border p-2 ${isNew ? "border-emerald-800 bg-emerald-950/20" : "border-zinc-800 bg-zinc-950"}`}>
      <div className="mb-1 flex gap-2 font-mono text-[11px] text-zinc-500">
        <span className="text-zinc-300">{m.role}</span>
        {m.tool_call_id && <span>for {m.tool_call_id.slice(0, 12)}</span>}
        {isNew && <span className="text-emerald-400">new at this step</span>}
      </div>
      {m.reasoning && <p className="mb-1 font-mono text-xs italic text-zinc-500">reasoning: {m.reasoning}</p>}
      {m.content && <p className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-200">{m.content}</p>}
      {m.tool_calls?.map((c) => (
        <p key={c.id} className="font-mono text-xs text-violet-300">
          → {c.function.name}({c.function.arguments})
        </p>
      ))}
    </div>
  );
}

function Inspector({ step, previousMessageCount }: { step: Step; previousMessageCount: number }) {
  if (step.type === "tool") {
    return (
      <>
        <Section title="Input"><Json value={step.input} /></Section>
        <Section title="Output"><Json value={step.output} /></Section>
      </>
    );
  }
  const messages = (step.input.messages ?? []) as Message[];
  const tools = ((step.input.tools ?? []) as { function: { name: string } }[]).map((t) => t.function.name);
  const output = step.output as { message?: Message; error?: string; usage?: unknown };
  return (
    <>
      <Section title={`Input: ${messages.length} messages · tools: ${tools.join(", ") || "none"}`}>
        <div className="space-y-1.5">
          {messages.map((m, i) => <MessageBlock key={i} m={m} isNew={i >= previousMessageCount} />)}
        </div>
      </Section>
      <Section title="Output">
        {output.message ? <MessageBlock m={output.message} isNew={false} /> : <Json value={output} />}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

export function RunView({ run }: { run: Run }) {
  const [selected, setSelected] = useState(0);
  const step = run.steps[selected];
  const previousModel = run.steps.slice(0, selected).reverse().find((s) => s.type === "model");
  const previousMessageCount = previousModel ? ((previousModel.input.messages as Message[])?.length ?? 0) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ol className="space-y-1">
        {run.steps.map((s) => (
          <li key={s.index}>
            <button
              onClick={() => setSelected(s.index)}
              className={`w-full rounded border px-3 py-2 text-left ${
                s.index === selected ? "border-emerald-700 bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 font-mono text-xs text-zinc-500">{s.index}</span>
                <Badge>{s.type}</Badge>
                <span className="truncate font-mono text-xs text-zinc-300">{s.name}</span>
                <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-zinc-500">
                  {s.tokens != null && `${s.tokens} tok · `}{s.latency_ms} ms
                </span>
              </div>
              <div className="mt-1 truncate pl-7 font-mono text-xs text-zinc-400">{stepSummary(s)}</div>
            </button>
          </li>
        ))}
      </ol>
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-zinc-100">step {step.index}</span>
          <Badge>{step.type}</Badge>
          <Badge>{step.source}</Badge>
          <span className="font-mono text-xs text-zinc-500">{step.name}</span>
        </div>
        <Inspector step={step} previousMessageCount={previousMessageCount} />
      </div>
    </div>
  );
}
