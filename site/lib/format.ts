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

export type TextBlock = { label: string; text: string };

/** "groq/openai/gpt-oss-20b" -> "gpt-oss-20b" */
export function shortName(name: string) {
  return name.split("/").pop() ?? name;
}

export function show(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function isError(output: unknown): output is { error: string } {
  return typeof output === "object" && output !== null && "error" in output;
}

function messageBlock(m: Message): TextBlock {
  if (m.role === "tool") return { label: "tool result", text: m.content ?? "" };
  const calls = (m.tool_calls ?? []).map((c) => `${c.function.name}(${c.function.arguments})`).join("\n");
  const parts = [m.reasoning && `reasoning: ${m.reasoning}`, m.content, calls].filter(Boolean);
  return { label: calls ? `${m.role} · tool call` : m.role, text: parts.join("\n\n") };
}

export function inputBlocks(step: Step): TextBlock[] {
  if (step.type === "tool") return [{ label: "arguments", text: show(step.input) }];
  const messages = (step.input.messages ?? []) as Message[];
  const tools = ((step.input.tools ?? []) as { function: { name: string } }[]).map((t) => t.function.name);
  return [...messages.map(messageBlock), ...(tools.length ? [{ label: "tools", text: tools.join(" · ") }] : [])];
}

export function outputBlocks(step: Step): TextBlock[] {
  if (isError(step.output)) return [{ label: "error", text: step.output.error }];
  if (step.type === "tool") return [{ label: "result", text: show(step.output) }];
  const m = (step.output as ModelOutput)?.message ?? { role: "assistant" };
  const blocks: TextBlock[] = [];
  if (m.reasoning) blocks.push({ label: "reasoning", text: m.reasoning });
  for (const c of m.tool_calls ?? []) blocks.push({ label: "tool call", text: `${c.function.name}(${c.function.arguments})` });
  if (m.content) blocks.push({ label: "final answer", text: m.content });
  return blocks;
}

export function outputNote(step: Step) {
  if (isError(step.output)) return "error";
  if (step.type === "tool") return typeof step.output === "string" ? `${step.output.length} chars` : "value";
  const calls = (step.output as ModelOutput)?.message?.tool_calls;
  return calls?.length ? `calls ${calls.map((c) => c.function.name).join(", ")}` : "final answer";
}

/** Timeline subtitle: tokens for model calls, latency for tool calls. */
export function stepShort(step: Step) {
  return step.type === "model" && step.tokens != null ? `${step.tokens} tok` : `${step.latency_ms} ms`;
}

export function stepMeta(step: Step) {
  const usage = (step.output as { usage?: { prompt_tokens?: number; completion_tokens?: number } })?.usage;
  const tokens =
    step.type === "model" && usage
      ? `prompt ${usage.prompt_tokens ?? "?"} · completion ${usage.completion_tokens ?? "?"} · ${step.tokens ?? "?"} tokens · `
      : "";
  return `${step.type === "model" ? "model call" : "tool call"} · ${tokens}${step.latency_ms} ms · ${step.source}`;
}
