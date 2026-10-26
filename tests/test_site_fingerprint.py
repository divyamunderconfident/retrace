"""The site's in-browser fingerprint must match retrace's step_hash byte for byte."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from retrace.recorder import step_hash

ROOT = Path(__file__).resolve().parent.parent
RUNS = sorted((ROOT / "site/public/data/runs").glob("*.json"))


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
@pytest.mark.parametrize("run_file", RUNS, ids=lambda p: p.stem[:8])
def test_browser_fingerprint_matches_python(run_file):
    out = subprocess.run(["node", str(ROOT / "site/scripts/fingerprints.mjs"), str(run_file)],
                         capture_output=True, text=True, check=True).stdout.split()
    steps = json.loads(run_file.read_text(encoding="utf-8"))["steps"]
    assert out == [step_hash(s["type"], s["name"], s["input"]) for s in steps]


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_non_ascii_and_nesting_match(tmp_path):
    run = {"steps": [{"type": "tool", "name": "save_note",
                      "input": {"text": "café ✓ \n\t\"q\" 😀", "z": [1, {"b": None, "a": True}], "a": -7}}]}
    path = tmp_path / "run.json"
    path.write_text(json.dumps(run), encoding="utf-8")
    out = subprocess.run(["node", str(ROOT / "site/scripts/fingerprints.mjs"), str(path)],
                         capture_output=True, text=True, check=True).stdout.split()
    s = run["steps"][0]
    assert out == [step_hash(s["type"], s["name"], s["input"])]
