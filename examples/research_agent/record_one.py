"""Record one research-agent run into runs.db and export it. Run from the repo root:

    .venv/Scripts/python -m examples.research_agent.record_one "your question"
"""

import sys

from retrace import llm
from retrace.recorder import export_run, record

from .agent import HERE, TOOLS, run

llm.load_env()
question = sys.argv[1] if len(sys.argv) > 1 else "How much more does a Cargo Lite cost than a Commuter?"
with record(TOOLS) as run_id:
    answer, _, _ = run(question)
(HERE / "recorded_run.json").write_text(export_run(run_id), encoding="utf-8")
print(f"run {run_id}: {answer}")
