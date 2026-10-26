"""Copy 3 mutation cases (correct run, broken run, diff) and the results into site/public/data.

Run from the repo root after the mutation experiment: .venv/Scripts/python scripts/export_site_data.py
"""

import json
import shutil
from pathlib import Path

RESULTS = Path("results")
OUT = Path("site/public/data")
PREFERRED = ["wrong-arg-calculator", "truncated-tool-results", "swallowed-search-error"]


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def final_answer(run):
    for step in reversed(run["steps"]):
        if step["type"] == "model" and isinstance(step["output"], dict) and "message" in step["output"]:
            return step["output"]["message"].get("content") or ""
    return ""


def main():
    mutations = {m["id"]: m for m in read(RESULTS / "mutations.json")}
    picked = [mutations[i] for i in PREFERRED if i in mutations and mutations[i]["first_divergence"] is not None]
    picked += [m for m in mutations.values() if m not in picked and m["first_divergence"] is not None]
    picked = picked[:3]

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "runs").mkdir(parents=True)
    (OUT / "diffs").mkdir()
    runs, diffs = [], []
    # Every run is listed; only the picked pairs ship their step files, the rest are summary only.
    for m in mutations.values():
        exported = m in picked
        for role in ("correct", "broken"):
            run = read(RESULTS / "runs" / f"{m[f'{role}_run']}.json")
            if exported:
                (OUT / "runs" / f"{run['run_id']}.json").write_text(json.dumps(run), encoding="utf-8")
            answer = final_answer(run)
            runs.append({"id": run["run_id"], "label": f"{m['id']} ({role})", "role": role, "mutation": m["id"],
                         "type": m["type"], "question": m["question"], "model": run["steps"][0]["name"],
                         "steps": len(run["steps"]) if exported else None,
                         "tokens": sum(s["tokens"] or 0 for s in run["steps"]), "answer": answer,
                         "stopped": not answer or answer.startswith("Stopped after"),
                         "has_file": exported, "diff": m["id"] if exported else None})
    for m in picked:
        shutil.copy(RESULTS / "diffs" / f"{m['id']}.json", OUT / "diffs" / f"{m['id']}.json")
        diffs.append({"id": m["id"], "type": m["type"], "description": m["description"],
                      "run_a": m["correct_run"], "run_b": m["broken_run"], "mutated_step": m["mutated_step"],
                      "first_divergence": m["first_divergence"], "kind": m["divergence_kind"]})
    (OUT / "index.json").write_text(json.dumps({"runs": runs, "diffs": diffs}, indent=2), encoding="utf-8")

    root_cause = read(RESULTS / "root_cause.json")
    for r in root_cause:  # keep the parsed answers; the raw replies stay in results/
        for condition in ("raw_logs", "diff_report"):
            r[condition].pop("raw_reply", None)
    (OUT / "results.json").write_text(json.dumps({"summary": read(RESULTS / "summary.json"),
                                                  "mutations": list(mutations.values()),
                                                  "root_cause": root_cause}, indent=2), encoding="utf-8")
    print(f"exported {len(runs)} runs and {len(diffs)} diffs: {', '.join(m['id'] for m in picked)}")


if __name__ == "__main__":
    main()
