"""R1 + R2: record every model and tool step of an agent run into SQLite, and export a run as JSON."""

import functools
import hashlib
import inspect
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager

from retrace import llm

DB_PATH = "runs.db"

SCHEMA = """CREATE TABLE IF NOT EXISTS steps (
    run_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    tokens INTEGER,
    latency_ms INTEGER NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY (run_id, idx)
)"""


def step_hash(kind, name, inp):
    """Identity of a step for replay: same type, name and input give the same hash."""
    payload = json.dumps({"type": kind, "name": name, "input": inp}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


@contextmanager
def record(tools, db=DB_PATH):
    """`with record(TOOLS) as run_id: ...` logs every llm.complete call and every call to a function in `tools`.

    Wraps llm.complete and the entries of the `tools` dict in place, and puts the originals back on exit.
    """
    with _session(tools, db, lambda step, kind, name, inp, call: ("live", inp, lambda: call(inp))) as run_id:
        yield run_id


@contextmanager
def _session(tools, db, handle):
    """Wrap llm.complete and the tools, and log each call as one step of a new run.

    For every call, `handle(step, kind, name, inp, call)` returns (source, input to log, produce) where
    `produce()` returns the step's result, either by calling `call(input)` live or from a recording.
    """
    # shortcut: patches the llm module attribute, so code that did `from retrace.llm import complete` is not
    # recorded; fine while every caller uses `llm.complete`, revisit if a caller binds the function directly.
    conn = sqlite3.connect(db, isolation_level=None)  # autocommit: steps survive a crash or a quota stop
    conn.execute(SCHEMA)
    run_id = uuid.uuid4().hex
    count = 0

    def wrap(fn, kind, tool_name=None):
        sig = inspect.signature(fn)

        @functools.wraps(fn)  # also copies markers such as side_effecting
        def wrapper(*args, **kwargs):
            nonlocal count
            try:
                bound = sig.bind(*args, **kwargs)
                bound.apply_defaults()
                inp = dict(bound.arguments)
                call = lambda i: fn(**i)  # noqa: E731
            except TypeError:  # e.g. the model called a tool with a wrong argument name; still worth recording
                inp = {"args": list(args), "kwargs": kwargs}
                call = lambda i: fn(*args, **kwargs)  # noqa: E731
            source, inp, produce = handle(count, kind, tool_name or inp.get("model", "?"), inp, call)
            inp_json = json.dumps(inp)  # serialise now: the agent appends to its message list afterwards
            output, tokens = None, None
            start = time.perf_counter()
            try:
                result = produce()
                output = result
                if kind == "model":
                    tokens = result.get("usage", {}).get("total_tokens")
                return result
            except Exception as e:
                output = {"error": f"{type(e).__name__}: {e}"}
                raise
            finally:
                conn.execute(
                    "INSERT INTO steps VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (run_id, count, kind, tool_name or inp.get("model", "?"), inp_json, json.dumps(output), tokens,
                     round((time.perf_counter() - start) * 1000), source),
                )
                count += 1

        return wrapper

    original_complete, original_tools = llm.complete, dict(tools)
    llm.complete = wrap(original_complete, "model")
    for tool_name, fn in original_tools.items():
        tools[tool_name] = wrap(fn, "tool", tool_name)
    try:
        yield run_id
    finally:
        llm.complete = original_complete
        tools.update(original_tools)
        conn.close()


def export_run(run_id, db=DB_PATH):
    """Return one run as a JSON string: {"run_id", "steps": [{index, type, name, input, output, tokens, latency_ms,
    source}]}. source is "live", "replay" (served from a recording) or "edited" (the fork point)."""
    conn = sqlite3.connect(db)
    try:
        rows = conn.execute(
            "SELECT idx, type, name, input, output, tokens, latency_ms, source FROM steps WHERE run_id = ? ORDER BY idx",
            (run_id,),
        ).fetchall()
    finally:
        conn.close()
    if not rows:
        raise KeyError(run_id)
    steps = [
        {"index": i, "type": t, "name": n, "input": json.loads(a), "output": json.loads(o), "tokens": k,
         "latency_ms": ms, "source": src}
        for i, t, n, a, o, k, ms, src in rows
    ]
    return json.dumps({"run_id": run_id, "steps": steps}, indent=2)
