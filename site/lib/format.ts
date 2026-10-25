import type { Step } from "./data";

export type Message = {
  role: string;
  content?: string | null;
  reasoning?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
};

type ModelOutput = { message?: Message; error?: string };

function clip(text: string, n: number) {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

/** One line describing what a step did, for timelines and diff rows. */
export function stepSummary(step: Step): string {
  if (step.type === "tool") {
    const args = Object.values(step.input).map((v) => JSON.stringify(v)).join(", ");
    const out = typeof step.output === "string" ? step.output : JSON.stringify(step.output);
    return `${step.name}(${clip(args, 60)}) → ${clip(out.replace(/\s+/g, " "), 60)}`;
  }
  const out = step.output as ModelOutput;
  if (out?.error) return `error: ${clip(out.error, 80)}`;
  const calls = out?.message?.tool_calls;
  if (calls?.length) return `calls ${calls.map((c) => `${c.function.name}(${clip(c.function.arguments, 50)})`).join(", ")}`;
  return `answers: ${clip(out?.message?.content ?? "", 90)}`;
}
