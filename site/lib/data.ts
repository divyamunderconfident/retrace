import { readFileSync } from "node:fs";
import path from "node:path";

// Read at build time only; the exported site is static and never calls a model.
const DATA_DIR = path.join(process.cwd(), "public", "data");

export function readData<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf-8")) as T;
}

export type Step = {
  index: number;
  type: "model" | "tool";
  name: string;
  input: Record<string, unknown>;
  output: unknown;
  tokens: number | null;
  latency_ms: number;
  source: "live" | "replay" | "edited";
};

export type Run = { run_id: string; steps: Step[] };

export type RunMeta = {
  id: string;
  label: string;
  role: "correct" | "broken";
  mutation: string;
  question: string;
  model: string;
  steps: number;
  tokens: number;
  answer: string;
};

export type DiffMeta = {
  id: string;
  type: string;
  description: string;
  run_a: string;
  run_b: string;
  mutated_step: number | null;
  first_divergence: number | null;
  kind: string | null;
};

export type Index = { runs: RunMeta[]; diffs: DiffMeta[] };

export type Change = { path: string; a: unknown; b: unknown };

export type Diff = {
  run_a: string;
  run_b: string;
  steps_a: number;
  steps_b: number;
  first_divergence: number | null;
  kind: "input" | "output" | "missing" | null;
  changes: Change[];
  tokens: { a: number; b: number; delta: number };
  cost_usd: { a: number; b: number; delta: number };
  report: string;
};

type Score = { step_correct: boolean; type_correct: boolean; correct: boolean };

export type Results = {
  summary: Record<string, number | string>;
  mutations: {
    id: string;
    type: string;
    description: string;
    mutated_step: number | null;
    first_divergence: number | null;
    match: boolean;
  }[];
  root_cause: {
    id: string;
    raw_logs: Score & { answer: Record<string, unknown> | null };
    diff_report: Score & { answer: Record<string, unknown> | null };
  }[];
};
