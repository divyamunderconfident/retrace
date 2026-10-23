"""Run the research agent on 5 questions and write transcripts.md. Run from the repo root:

    .venv/Scripts/python -m examples.research_agent.run
"""

import sys

from retrace import llm

from .agent import HERE, run

QUESTIONS = [
    "What was Brightwater Cycles' total revenue in 2025?",
    "Why were Ridgeline bikes recalled in 2025, and which battery supplier does Brightwater use now?",
    "What will a Ridgeline cost after the March 2026 price change?",
    "What was revenue per employee at the end of 2025?",
    "Summarise the warranty terms for the frame, battery and motor, and save them as a note.",
]


def transcript(question, answer, messages, steps):
    lines = [f"## {question}", ""]
    for m in messages[2:]:
        if m["role"] == "tool":
            lines.append(f"- **tool result:** {m['content'][:300]!r}")
        for call in m.get("tool_calls") or []:
            lines.append(f"- **call** `{call['function']['name']}({call['function']['arguments']})`")
    tokens = sum(s["usage"].get("total_tokens", 0) for s in steps)
    cached = sum(s["cached"] for s in steps)
    lines += ["", f"**Answer:** {answer}", "", f"_{len(steps)} model calls, {tokens} tokens, {cached} from cache_", ""]
    return "\n".join(lines)


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252; models emit characters like U+202F
    llm.load_env()
    parts = ["# Research agent transcripts", ""]
    try:
        for q in QUESTIONS:
            parts.append(transcript(q, *run(q)))
            print(parts[-1])
    except llm.QuotaExceeded as e:
        print(f"Quota reached, stopping. Re-run to resume from the cache. ({e})")
    finally:
        (HERE / "transcripts.md").write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    main()
