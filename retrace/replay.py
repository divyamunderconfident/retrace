"""R3-R5: replay a recorded run from its outputs, fork it at a step, and never repeat side effects."""

import copy
import json
from collections import defaultdict, deque
from contextlib import contextmanager

from retrace.recorder import DB_PATH, _session, export_run, step_hash


class ReplayDivergence(Exception):
    """A call during replay has no matching step in the recording."""


def _load(run_id, db):
    """Return the recorded steps and, per step hash, a queue of outputs in recorded order."""
    steps = json.loads(export_run(run_id, db))["steps"]
    outputs = defaultdict(deque)
    for s in steps:
        outputs[step_hash(s["type"], s["name"], s["input"])].append(s["output"])
    return steps, outputs


def _serve(output):
    """Return a recorded output, or re-raise a recorded error so the agent sees the same error text."""
    if isinstance(output, dict) and list(output) == ["error"]:
        # shortcut: raises a stand-in class with the original name, so `except ZeroDivisionError` won't catch it
        # (`except Exception` will); store the real exception type if an agent needs specific except clauses.
        name, _, message = output["error"].partition(": ")
        raise type(name, (Exception,), {})(message)
    return output


def _from_recording(outputs, step, kind, name, inp):
    queue = outputs.get(step_hash(kind, name, inp))
    if not queue:
        raise ReplayDivergence(f"step {step} ({kind} {name}) does not match any recorded step")
    output = queue.popleft()
    return "replay", inp, lambda: _serve(output)


@contextmanager
def replay(run_id, tools, db=DB_PATH):
    """`with replay(run_id, TOOLS) as new_id: agent()` serves every step from the recording; nothing runs live.

    Raises ReplayDivergence if the agent makes a call the recording does not have.
    """
    _, outputs = _load(run_id, db)
    with _session(tools, db, lambda step, kind, name, inp, call: _from_recording(outputs, step, kind, name, inp)) \
            as new_id:
        yield new_id


@contextmanager
def fork(run_id, step, edit, tools, db=DB_PATH):
    """Replay steps before `step`, apply `edit` at `step`, and run live from there.

    At a tool step, `edit(recorded_output)` returns the new output and the tool is not called.
    At a model step, `edit(input)` returns the new input; it is applied to that call and every later model call,
    so an edited system prompt or message stays edited for the rest of the run.
    Side-effecting tools never repeat a call the recording already made; new calls run.
    """
    steps, outputs = _load(run_id, db)
    if not 0 <= step < len(steps):
        raise ValueError(f"step {step} is out of range: run {run_id} has {len(steps)} steps")
    fork_kind = steps[step]["type"]
    side_effecting = {name for name, fn in tools.items() if getattr(fn, "side_effecting", False)}

    def handle(i, kind, name, inp, call):
        if i < step:
            return _from_recording(outputs, i, kind, name, inp)
        if kind == "model" and fork_kind == "model":
            inp = edit(copy.deepcopy(inp))  # copy so an in-place edit cannot change the agent's own messages
        if i == step:
            if kind != fork_kind:
                raise ReplayDivergence(f"step {step} is a {kind} call, but the recording has a {fork_kind} step")
            if kind == "tool":
                edited = edit(copy.deepcopy(steps[step]["output"]))
                return "edited", inp, lambda: _serve(edited)
            return "edited", inp, lambda: call(inp)
        if kind == "tool" and name in side_effecting and outputs.get(step_hash(kind, name, inp)):
            return _from_recording(outputs, i, kind, name, inp)
        return "live", inp, lambda: call(inp)

    with _session(tools, db, handle) as new_id:
        yield new_id
