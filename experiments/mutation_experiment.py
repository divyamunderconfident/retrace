"""Mutation experiment, small version: 10 seeded bugs in the research agent, 2 for each PRD bug type.

For each mutation we record a correct run and a broken run of the same question.
  A: does diff()'s first divergence land on the step the mutation first changed?
  B: given the raw JSON logs of both runs, or Retrace's diff report, does a model name the right step and bug type?

Run from the repo root (safe to re-run; it resumes from results/ and the llm.py cache):
    .venv/Scripts/python -m experiments.mutation_experiment
"""

import contextlib
import copy
import functools
import json
import re
import sqlite3
import sys
import time
from pathlib import Path

import requests

from examples.research_agent import agent
from retrace import config, llm
from retrace.diff import diff, diff_report
from retrace.recorder import export_run, record

RESULTS = Path("results")
DB = RESULTS / "experiment.db"
TYPES = ["wrong tool argument", "truncated context", "vague tool description", "contradicting instruction",
         "swallowed tool error"]
ANALYST_MODEL = config.GEMINI_MODEL  # raw logs exceed Groq's free 8,000 tokens-per-minute limit in one request

Q_REVENUE = "What was Brightwater Cycles' total revenue in 2025?"
Q_RECALL = "Why were Ridgeline bikes recalled in 2025, and which battery supplier does Brightwater use now?"
Q_PRICE = "What will a Ridgeline cost after the March 2026 price change?"
Q_PER_EMPLOYEE = "What was revenue per employee at the end of 2025?"
Q_CARGO = "How much more does a Cargo Lite cost than a Commuter?"


@contextlib.contextmanager
def swap(target, key, value):
    """Temporarily replace a module attribute or a dict item."""
    is_dict = isinstance(target, dict)
    old = target[key] if is_dict else getattr(target, key)
    target.__setitem__(key, value) if is_dict else setattr(target, key, value)
    try:
        yield
    finally:
        target.__setitem__(key, old) if is_dict else setattr(target, key, old)


# Each mutation patches the agent. "below" patches are installed before record(), so the recorder sees their
# effect as a changed output or a changed first input; "above" patches wrap the recorder, so it sees a changed input.
# fire() is called when the mutation first changes something; it stores that step's index as the ground truth.

def wrong_argument(tool, change):
    def patch(fire):
        recorded = agent.TOOLS[tool]

        @functools.wraps(recorded)
        def wrong(**kwargs):
            changed = change(dict(kwargs))
            if changed != kwargs:
                fire()
            return recorded(**changed)
        return swap(agent.TOOLS, tool, wrong)
    return {"layer": "above", "patch": patch}


def truncated_context(cut):
    def patch(fire):
        recorded = llm.complete

        def truncating(messages, tools=None, model=config.DEFAULT_MODEL):
            kept = cut(messages)
            if kept != messages:
                fire()
            return recorded(kept, tools, model)
        return swap(llm, "complete", truncating)
    return {"layer": "above", "patch": patch}


def vague_description(tool, description):
    def patch(fire):
        schemas = copy.deepcopy(agent.TOOL_SCHEMAS)
        for schema in schemas:
            if schema["function"]["name"] == tool:
                schema["function"]["description"] = description
                for prop in schema["function"]["parameters"]["properties"].values():
                    prop["description"] = "input"
        return swap(agent, "TOOL_SCHEMAS", schemas)
    return {"layer": "below", "patch": patch, "fixed_step": 0}  # tool schemas are part of every model input


def contradicting_instruction(text):
    return {"layer": "below", "patch": lambda fire: swap(agent, "SYSTEM", f"{agent.SYSTEM} {text}"),
            "fixed_step": 0}  # the system prompt is part of every model input


def swallowed_error(tool, returns):
    def patch(fire):
        original = agent.TOOLS[tool]

        @functools.wraps(original)
        def broken(**kwargs):
            try:
                raise OSError(f"{tool} backend unavailable")
            except OSError:
                fire()
                return returns  # the bug: the error is hidden and an empty result looks like success
        return swap(agent.TOOLS, tool, broken)
    return {"layer": "below", "patch": patch}


MUTATIONS = [
    {"id": "wrong-arg-calculator", "type": "wrong tool argument", "question": Q_CARGO,
     "description": "The agent passes the calculator an expression with '-' turned into '+'.",
     **wrong_argument("calculator", lambda kw: {**kw, "expression": kw["expression"].replace("-", "+")})},
    {"id": "wrong-arg-search", "type": "wrong tool argument", "question": Q_RECALL,
     "description": "The agent passes search_docs only the first word of the query.",
     **wrong_argument("search_docs", lambda kw: {**kw, "query": kw["query"].split()[0]})},
    {"id": "truncated-drop-question", "type": "truncated context", "question": Q_REVENUE,
     "description": "Once the history has more than 4 messages, the user's question is dropped from it.",
     **truncated_context(lambda m: m if len(m) <= 4 else [x for x in m if x["role"] != "user"])},
    {"id": "truncated-tool-results", "type": "truncated context", "question": Q_PRICE,
     "description": "Tool results in the history are cut to their first 60 characters.",
     **truncated_context(lambda m: [{**x, "content": x["content"][:60]} if x["role"] == "tool" else x for x in m])},
    {"id": "vague-search-description", "type": "vague tool description", "question": Q_RECALL,
     "description": "search_docs is described as 'Does a lookup.' and its parameter as 'input'.",
     **vague_description("search_docs", "Does a lookup.")},
    {"id": "vague-calculator-description", "type": "vague tool description", "question": Q_PRICE,
     "description": "calculator is described as 'Utility.' and its parameter as 'input'.",
     **vague_description("calculator", "Utility.")},
    {"id": "contradiction-no-tools", "type": "contradicting instruction", "question": Q_REVENUE,
     "description": "The system prompt adds: 'Never call tools. Answer immediately from your own knowledge.'",
     **contradicting_instruction("Never call tools. Answer immediately from your own knowledge.")},
    {"id": "contradiction-no-calculator", "type": "contradicting instruction", "question": Q_PER_EMPLOYEE,
     "description": "The system prompt adds: 'Do not use the calculator; do all arithmetic in your head.'",
     **contradicting_instruction("Do not use the calculator; do all arithmetic in your head.")},
    {"id": "swallowed-search-error", "type": "swallowed tool error", "question": Q_CARGO,
     "description": "search_docs fails internally and returns an empty string instead of an error.",
     **swallowed_error("search_docs", "")},
    {"id": "swallowed-calculator-error", "type": "swallowed tool error", "question": Q_PRICE,
     "description": "calculator fails internally and returns an empty string instead of an error.",
     **swallowed_error("calculator", "")},
]


def retrying(fn):
    """Wait out per-minute limits and brief overloads; let a daily quota stop the experiment."""
    for _ in range(30):
        try:
            return fn()
        except llm.QuotaExceeded as e:
            if "minute" not in str(e).lower():
                raise
            wait = re.search(r"try again in ([\d.]+)s", str(e))
            time.sleep(float(wait.group(1)) + 1 if wait else 30)
        except requests.HTTPError as e:
            if not str(e).startswith(("500", "502", "503")):
                raise
            time.sleep(20)
    raise RuntimeError("still rate-limited after 30 tries")


def record_run(question, mutation=None):
    """Record one run; return (run_id, answer, mutated_step)."""
    state = {"run_id": None, "step": None}

    def fire():
        if state["step"] is None:
            conn = sqlite3.connect(DB)
            state["step"] = conn.execute("SELECT COUNT(*) FROM steps WHERE run_id = ?", (state["run_id"],)).fetchone()[0]
            conn.close()

    layer = mutation["layer"] if mutation else None
    with mutation["patch"](fire) if layer == "below" else contextlib.nullcontext():
        with record(agent.TOOLS, db=DB) as run_id:
            state["run_id"] = run_id
            with mutation["patch"](fire) if layer == "above" else contextlib.nullcontext():
                answer, _, _ = agent.run(question)
    return run_id, answer, mutation.get("fixed_step", state["step"]) if mutation else None


def experiment_a(m):
    correct_id, correct_answer, _ = retrying(lambda: record_run(m["question"]))
    broken_id, broken_answer, mutated_step = retrying(lambda: record_run(m["question"], m))
    d = diff(correct_id, broken_id, db=DB)
    for run_id in (correct_id, broken_id):
        (RESULTS / "runs" / f"{run_id}.json").write_text(export_run(run_id, db=DB), encoding="utf-8")
    (RESULTS / "diffs" / f"{m['id']}.json").write_text(
        json.dumps({**d, "report": diff_report(d)}, indent=2), encoding="utf-8")
    return {"id": m["id"], "type": m["type"], "question": m["question"], "description": m["description"],
            "correct_run": correct_id, "broken_run": broken_id, "correct_answer": correct_answer,
            "broken_answer": broken_answer, "mutated_step": mutated_step, "first_divergence": d["first_divergence"],
            "divergence_kind": d["kind"], "match": mutated_step is not None and d["first_divergence"] == mutated_step,
            "tokens_correct": d["tokens"]["a"], "tokens_broken": d["tokens"]["b"]}


INSTRUCTIONS = (
    "You debug AI agents. Run a of a research agent is correct and run b is broken; the only difference is one "
    "bug in the agent's code or configuration. Find the root cause.\n"
    "Reply with JSON only, no other text: {\"step\": <index of the first step of run b where the bug shows>, "
    f"\"bug_type\": <one of {json.dumps(TYPES)}>, \"explanation\": <one sentence>}}"
)


def ask_analyst(evidence):
    out = retrying(lambda: llm.complete([{"role": "user", "content": f"{INSTRUCTIONS}\n\n{evidence}"}],
                                        None, ANALYST_MODEL))
    text = out["message"].get("content") or ""
    match = re.search(r"\{.*\}", text, re.S)
    try:
        parsed = json.loads(match.group(0)) if match else None
    except json.JSONDecodeError:
        parsed = None
    return text, parsed if isinstance(parsed, dict) else None


def score(parsed, row):
    """Fixed rules: the step must equal the mutated step and the bug type must equal the mutation type."""
    try:
        step_ok = int(parsed["step"]) == row["mutated_step"]
    except (TypeError, KeyError, ValueError):
        step_ok = False
    type_ok = isinstance(parsed, dict) and str(parsed.get("bug_type", "")).strip().lower() == row["type"]
    return {"step_correct": step_ok, "type_correct": type_ok, "correct": step_ok and type_ok}


def experiment_b(row):
    compact = {r: json.dumps(json.loads(export_run(row[r], db=DB))) for r in ("correct_run", "broken_run")}
    raw = f"Run a (correct), JSON log:\n{compact['correct_run']}\n\nRun b (broken), JSON log:\n{compact['broken_run']}"
    report = json.loads((RESULTS / "diffs" / f"{row['id']}.json").read_text(encoding="utf-8"))["report"]
    result = {"id": row["id"]}
    for condition, evidence in (("raw_logs", raw), ("diff_report", f"Retrace diff report:\n{report}")):
        text, parsed = ask_analyst(evidence)
        result[condition] = {"answer": parsed, "raw_reply": text, **score(parsed, row)}
    return result


def load(name):
    path = RESULTS / name
    return {r["id"]: r for r in json.loads(path.read_text(encoding="utf-8"))} if path.exists() else {}


def save(name, rows):
    (RESULTS / name).write_text(json.dumps(list(rows.values()), indent=2), encoding="utf-8")


def summarise(a_rows, b_rows):
    fired = [r for r in a_rows.values() if r["mutated_step"] is not None]
    summary = {
        "mutations": len(a_rows), "fired": len(fired),
        "a_matches": sum(r["match"] for r in fired),
        "analyst_model": ANALYST_MODEL, "agent_model": config.GROQ_MODEL, "b_scored": len(b_rows),
    }
    for condition in ("raw_logs", "diff_report"):
        for key in ("step_correct", "type_correct", "correct"):
            summary[f"b_{condition}_{key}"] = sum(r[condition][key] for r in b_rows.values())
    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def write_results_md(a_rows, b_rows, s):
    def mark(ok):
        return "yes" if ok else "no"

    lines = [
        "# Results", "",
        "Generated by `experiments/mutation_experiment.py` from the files in `results/`. Small version: "
        f"{s['mutations']} mutations, one trial each.", "",
        "## Headline", "",
        f"- **Experiment A, bug localisation:** the diff's first divergence was the mutated step in "
        f"**{s['a_matches']} of {s['fired']}** mutations that changed the run.",
        f"- **Experiment B, root cause** ({s['analyst_model']}, step and bug type both right): "
        f"**{s['b_raw_logs_correct']} of {s['b_scored']}** from raw JSON logs vs "
        f"**{s['b_diff_report_correct']} of {s['b_scored']}** from the diff report.",
        f"  - Step right: {s['b_raw_logs_step_correct']} vs {s['b_diff_report_step_correct']}. "
        f"Bug type right: {s['b_raw_logs_type_correct']} vs {s['b_diff_report_type_correct']}.",
        f"- **PRD target** (diff report right at least twice as often as raw logs): "
        f"{'met' if s['b_diff_report_correct'] >= 2 * s['b_raw_logs_correct'] else 'not met'} in this run.", "",
        "## Per mutation", "",
        "| Mutation | Type | Mutated step | First divergence | A match | B raw logs | B diff report |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in a_rows.values():
        b = b_rows.get(r["id"])
        lines.append(f"| {r['id']} | {r['type']} | {r['mutated_step']} | {r['first_divergence']} | {mark(r['match'])} "
                     f"| {mark(b['raw_logs']['correct']) if b else '-'} | {mark(b['diff_report']['correct']) if b else '-'} |")
    lines += [
        "", "## Method", "",
        f"- Agent: the demo research agent on {s['agent_model']}, temperature 0. Each mutation patches the agent "
        "(see `MUTATIONS` in the script); the mutated step is logged by the mutation itself when it first changes "
        "an input or output, independently of the diff.",
        "- A: `diff(correct, broken)` first divergence compared with the mutated step.",
        "- B: the analyst model gets the same instructions plus either both runs' JSON logs or the diff report, and "
        "must reply with a step index and one of the 5 bug types. Scored by exact match, no partial credit.",
        "", "## Limitations", "",
        "- 10 mutations and one trial each: the numbers are indicative, not statistically meaningful.",
        "- Steps before the mutation are identical by construction: model calls with the same input come from "
        "llm.py's cache. Without the cache, a live model at temperature 0 can still vary between runs and create "
        "divergences unrelated to the bug.",
        "- Mutations that change the system prompt or a tool description take effect at step 0, so locating them "
        "is easy; the harder cases are the tool and context mutations.",
        "- The demo runs are short (a few steps), so the raw logs are small enough for the analyst to read whole. "
        "The PRD's premise is long runs, where raw logs are a wall of JSON; this experiment does not test that.",
        "- One analyst model, one prompt.",
    ]
    Path("RESULTS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    llm.load_env()
    for sub in ("runs", "diffs"):
        (RESULTS / sub).mkdir(parents=True, exist_ok=True)
    a_rows, b_rows = load("mutations.json"), load("root_cause.json")
    try:
        for m in MUTATIONS:
            if m["id"] not in a_rows:
                a_rows[m["id"]] = experiment_a(m)
                save("mutations.json", a_rows)
            r = a_rows[m["id"]]
            print(f"A {m['id']}: mutated step {r['mutated_step']}, first divergence {r['first_divergence']}, "
                  f"match {r['match']}")
        for m in MUTATIONS:
            if m["id"] not in b_rows and a_rows[m["id"]]["mutated_step"] is not None:
                b_rows[m["id"]] = experiment_b(a_rows[m["id"]])
                save("root_cause.json", b_rows)
                b = b_rows[m["id"]]
                print(f"B {m['id']}: raw {b['raw_logs']['correct']}, diff {b['diff_report']['correct']}")
    except llm.QuotaExceeded as e:
        print(f"Daily quota reached; progress is saved. Re-run later to resume. ({str(e)[:200]})")
        return
    s = summarise(a_rows, b_rows)
    write_results_md(a_rows, b_rows, s)
    print(json.dumps(s, indent=2))


if __name__ == "__main__":
    main()
