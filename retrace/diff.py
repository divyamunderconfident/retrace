"""R7: compare two recorded runs and find the first step where they diverge."""

import json

from retrace import config
from retrace.recorder import DB_PATH, export_run

MISSING = "<missing>"
VOLATILE_MODEL_FIELDS = ("usage", "latency_ms", "cached")  # differ between a live call and a cached one
MAX_CHANGES = 8


def _comparable(step):
    """What the agent actually saw: drop timing and cache flags from model outputs."""
    output = step["output"]
    if step["type"] == "model" and isinstance(output, dict):
        output = {k: v for k, v in output.items() if k not in VOLATILE_MODEL_FIELDS}
    return {"type": step["type"], "name": step["name"], "input": step["input"], "output": output}


def _changes(a, b, path, out):
    """Collect up to MAX_CHANGES leaf paths where a and b differ."""
    if len(out) >= MAX_CHANGES or a == b:
        return out
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a) | set(b)):
            _changes(a.get(key, MISSING), b.get(key, MISSING), f"{path}.{key}" if path else key, out)
    elif isinstance(a, list) and isinstance(b, list):
        for i in range(max(len(a), len(b))):
            _changes(a[i] if i < len(a) else MISSING, b[i] if i < len(b) else MISSING, f"{path}[{i}]", out)
    else:
        out.append({"path": path, "a": a, "b": b})
    return out


def _totals(steps):
    tokens = sum(s["tokens"] or 0 for s in steps)
    cost = sum((s["tokens"] or 0) * config.PRICE_PER_MILLION_TOKENS.get(s["name"].split("/")[0], 0.0) / 1e6
               for s in steps if s["type"] == "model")
    return tokens, cost


def _summary(step):
    return None if step is None else {"index": step["index"], "type": step["type"], "name": step["name"]}


def diff(run_a, run_b, db=DB_PATH):
    """Return the first divergent step of two runs, what changed there, and the token and cost delta."""
    a, b = (json.loads(export_run(r, db))["steps"] for r in (run_a, run_b))
    first, kind, changes = None, None, []
    for i in range(max(len(a), len(b))):
        if i >= len(a) or i >= len(b):
            first, kind = i, "missing"
            break
        ca, cb = _comparable(a[i]), _comparable(b[i])
        if ca != cb:
            first = i
            kind = "output" if (ca["type"], ca["name"], ca["input"]) == (cb["type"], cb["name"], cb["input"]) else "input"
            changes = _changes(ca if kind == "input" else ca["output"], cb if kind == "input" else cb["output"],
                               "" if kind == "input" else "output", [])
            break
    (tokens_a, cost_a), (tokens_b, cost_b) = _totals(a), _totals(b)
    return {
        "run_a": run_a, "run_b": run_b, "steps_a": len(a), "steps_b": len(b),
        "first_divergence": first, "kind": kind,
        "step_a": _summary(a[first]) if first is not None and first < len(a) else None,
        "step_b": _summary(b[first]) if first is not None and first < len(b) else None,
        "changes": changes,
        "tokens": {"a": tokens_a, "b": tokens_b, "delta": tokens_b - tokens_a},
        "cost_usd": {"a": round(cost_a, 6), "b": round(cost_b, 6), "delta": round(cost_b - cost_a, 6)},
        "after_a": [f"{s['type']}:{s['name']}" for s in a[first + 1:]] if first is not None else [],
        "after_b": [f"{s['type']}:{s['name']}" for s in b[first + 1:]] if first is not None else [],
    }


def _short(value, limit=300):
    text = value if value == MISSING else repr(value)
    return text if len(text) <= limit else text[:limit] + f"... ({len(text)} chars)"


def diff_report(d):
    """A short plain-text report of a diff, for people and for models."""
    lines = [f"Run a: {d['run_a']} ({d['steps_a']} steps, {d['tokens']['a']} tokens)",
             f"Run b: {d['run_b']} ({d['steps_b']} steps, {d['tokens']['b']} tokens)"]
    if d["first_divergence"] is None:
        lines.append(f"The runs are identical over {d['steps_a']} steps.")
    else:
        step = d["step_a"] or d["step_b"]
        if d["kind"] == "missing":
            side = "b" if d["step_b"] is None else "a"
            lines.append(f"First divergence: step {d['first_divergence']} ({step['type']} {step['name']}), "
                         f"missing in run {side}")
        else:
            lines.append(f"First divergence: step {d['first_divergence']} ({step['type']} {step['name']}), "
                         f"{d['kind']} changed")
            if d["step_a"] != d["step_b"]:
                lines.append(f"  run a step: {d['step_a']['type']} {d['step_a']['name']}; "
                             f"run b step: {d['step_b']['type']} {d['step_b']['name']}")
            for c in d["changes"]:
                lines.append(f"  {c['path']}: {_short(c['a'])} -> {_short(c['b'])}")
        lines.append(f"After the divergence, run a: {', '.join(d['after_a']) or 'nothing'}")
        lines.append(f"After the divergence, run b: {', '.join(d['after_b']) or 'nothing'}")
    t, c = d["tokens"], d["cost_usd"]
    lines.append(f"Tokens: {t['a']} -> {t['b']} ({t['delta']:+d}); cost: ${c['a']:.4f} -> ${c['b']:.4f} "
                 f"({c['delta']:+.4f})")
    return "\n".join(lines)
