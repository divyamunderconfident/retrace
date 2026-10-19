"""One tiny real call per provider whose key is in .env. Run from the repo root; not part of pytest.

Usage: .venv/Scripts/python scripts/smoke_test.py
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from retrace import config, llm  # noqa: E402

MODELS = {"GROQ_API_KEY": config.GROQ_MODEL, "GEMINI_API_KEY": config.GEMINI_MODEL}
MESSAGES = [{"role": "user", "content": "Reply with exactly one word: hello"}]

# Load KEY=value lines into the environment. Values are never printed.
if Path(".env").exists():
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        name, sep, value = line.partition("=")
        if sep and not line.lstrip().startswith("#"):
            os.environ.setdefault(name.strip(), value.strip().strip("'\""))

for key_var, model in MODELS.items():
    if not os.environ.get(key_var):
        print(f"{model}: skipped, {key_var} not set")
        continue
    try:
        out = llm.complete(MESSAGES, model=model)
    except Exception as e:
        print(f"{model}: FAILED, {type(e).__name__}: {str(e)[:200]}")
        continue
    reply = (out["message"].get("content") or "").strip()
    print(f"{model}: reply={reply!r} total_tokens={out['usage'].get('total_tokens')} cached={out['cached']}")
