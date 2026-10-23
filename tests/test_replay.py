import functools
import json
import sqlite3
from collections import Counter

import pytest

from examples.research_agent import agent
from retrace.recorder import export_run, record
from retrace.replay import ReplayDivergence, fork, replay


def tool_call(name, arguments, id="c1"):
    return {"role": "assistant", "content": None,
            "tool_calls": [{"id": id, "type": "function", "function": {"name": name, "arguments": json.dumps(arguments)}}]}


def answer(text):
    return {"role": "assistant", "content": text}


@pytest.fixture
def db(tmp_path):
    return tmp_path / "runs.db"


@pytest.fixture
def executed(monkeypatch, tmp_path):
    """Counts real executions of each agent tool; notes go to a temp file."""
    monkeypatch.setattr(agent, "NOTES_PATH", tmp_path / "notes.md")
    calls = Counter()

    def counted(name, fn):
        @functools.wraps(fn)  # keeps the signature and the side_effecting marker
        def wrapper(**kwargs):
            calls[name] += 1
            return fn(**kwargs)
        return wrapper

    monkeypatch.setattr(agent, "TOOLS", {name: counted(name, fn) for name, fn in agent.TOOLS.items()})
    return calls


def recorded(fake_llm, db, question, replies):
    fake_llm.replies = list(replies)
    with record(agent.TOOLS, db=db) as run_id:
        result = agent.run(question, model="groq/m")
    return run_id, result


def raw_outputs(db, run_id):
    with sqlite3.connect(db) as conn:
        return [row[0] for row in conn.execute("SELECT output FROM steps WHERE run_id = ? ORDER BY idx", (run_id,))]


def sources(db, run_id):
    return [s["source"] for s in json.loads(export_run(run_id, db=db))["steps"]]


def scenario(i):
    """Ten varied runs: search, arithmetic, notes on even runs, and a tool error in run 7."""
    replies = [tool_call("search_docs", {"query": f"revenue Q{i % 4 + 1} 2025"}, id=f"s{i}"),
               tool_call("calculator", {"expression": "1 / 0" if i == 7 else f"{i} * 3"}, id=f"c{i}")]
    if i % 2 == 0:
        replies.append(tool_call("save_note", {"text": f"note {i}"}, id=f"n{i}"))
    return f"question {i}", replies + [answer(f"answer {i}")]


def test_replay_fidelity_is_byte_identical_over_10_runs(fake_llm, db, executed):
    runs = [(q, *recorded(fake_llm, db, q, replies)) for q, replies in map(scenario, range(10))]
    notes_before = agent.NOTES_PATH.read_text(encoding="utf-8")
    model_calls_before = len(fake_llm.calls)
    executed.clear()

    fake_llm.replies = []  # any real model call during replay would fail
    for question, run_id, (original_answer, original_messages, _) in runs:
        with replay(run_id, agent.TOOLS, db=db) as replay_id:
            replayed_answer, replayed_messages, _ = agent.run(question, model="groq/m")
        assert raw_outputs(db, replay_id) == raw_outputs(db, run_id)
        assert (replayed_answer, replayed_messages) == (original_answer, original_messages)
        assert set(sources(db, replay_id)) == {"replay"}

    assert len(fake_llm.calls) == model_calls_before
    assert sum(executed.values()) == 0
    assert agent.NOTES_PATH.read_text(encoding="utf-8") == notes_before


def test_side_effecting_tool_never_runs_during_replay(fake_llm, db, executed):
    run_id, _ = recorded(fake_llm, db, "save it", [tool_call("save_note", {"text": "hello"}), answer("Saved.")])
    assert executed["save_note"] == 1

    with replay(run_id, agent.TOOLS, db=db):
        agent.run("save it", model="groq/m")

    assert executed["save_note"] == 1, "a side-effecting tool ran during replay"
    assert agent.NOTES_PATH.read_text(encoding="utf-8") == "hello\n\n"


def test_replayed_tool_error_reaches_the_agent_unchanged(fake_llm, db, executed):
    run_id, (_, original, _) = recorded(fake_llm, db, "1/0?", [tool_call("calculator", {"expression": "1 / 0"}),
                                                                answer("Cannot.")])
    with replay(run_id, agent.TOOLS, db=db):
        _, replayed, _ = agent.run("1/0?", model="groq/m")
    assert replayed[3] == original[3] == {"role": "tool", "tool_call_id": "c1",
                                          "content": "Error: ZeroDivisionError: division by zero"}


def test_replay_with_a_different_input_diverges(fake_llm, db):
    run_id, _ = recorded(fake_llm, db, "one", [answer("1")])
    with pytest.raises(ReplayDivergence, match="step 0"):
        with replay(run_id, agent.TOOLS, db=db):
            agent.run("two", model="groq/m")


def test_fork_at_tool_step_uses_edited_output_then_runs_live(fake_llm, db, executed):
    run_id, _ = recorded(fake_llm, db, "2+2?", [tool_call("calculator", {"expression": "2 + 2"}), answer("It is 4.")])
    executed.clear()
    calls_before = len(fake_llm.calls)

    fake_llm.replies = [answer("It is 5.")]
    with fork(run_id, step=1, edit=lambda output: "5", tools=agent.TOOLS, db=db) as fork_id:
        result, messages, _ = agent.run("2+2?", model="groq/m")

    assert result == "It is 5."
    assert messages[3]["content"] == "5"
    assert executed["calculator"] == 0  # the edited step replaces the tool call
    assert len(fake_llm.calls) == calls_before + 1  # only the step after the fork point hit the model
    assert sources(db, fork_id) == ["replay", "edited", "live"]


def test_fork_at_model_step_keeps_the_edit_for_later_model_calls(fake_llm, db, executed):
    run_id, _ = recorded(fake_llm, db, "2+2?", [tool_call("calculator", {"expression": "2 + 2"}), answer("4")])
    calls_before = len(fake_llm.calls)

    def brief(inp):
        return {**inp, "messages": [{"role": "system", "content": "Be brief."}] + inp["messages"][1:]}

    fake_llm.replies = [tool_call("calculator", {"expression": "2 + 2"}), answer("4.")]
    with fork(run_id, step=0, edit=brief, tools=agent.TOOLS, db=db) as fork_id:
        agent.run("2+2?", model="groq/m")

    live_calls = fake_llm.calls[calls_before:]
    assert [c["body"]["messages"][0]["content"] for c in live_calls] == ["Be brief.", "Be brief."]
    assert sources(db, fork_id) == ["edited", "live", "live"]
    assert json.loads(export_run(fork_id, db=db))["steps"][0]["input"]["messages"][0]["content"] == "Be brief."


def test_fork_never_repeats_a_recorded_side_effect_but_runs_new_ones(fake_llm, db, executed):
    run_id, _ = recorded(fake_llm, db, "note", [tool_call("save_note", {"text": "hello"}, id="n1"), answer("Done.")])

    def new_prompt(inp):  # must change the input, or llm.py's own disk cache answers the "live" calls
        return {**inp, "messages": [{"role": "system", "content": "Save notes."}] + inp["messages"][1:]}

    fake_llm.replies = [tool_call("save_note", {"text": "hello"}, id="n1"),
                        tool_call("save_note", {"text": "new"}, id="n2"), answer("Done twice.")]
    with fork(run_id, step=0, edit=new_prompt, tools=agent.TOOLS, db=db) as fork_id:
        agent.run("note", model="groq/m")

    assert executed["save_note"] == 2  # once when recording, once for the new note; "hello" was not repeated
    assert agent.NOTES_PATH.read_text(encoding="utf-8") == "hello\n\nnew\n\n"
    assert sources(db, fork_id) == ["edited", "replay", "live", "live", "live"]


def test_fork_step_out_of_range_raises(fake_llm, db):
    run_id, _ = recorded(fake_llm, db, "one", [answer("1")])
    with pytest.raises(ValueError):
        with fork(run_id, step=5, edit=lambda x: x, tools=agent.TOOLS, db=db):
            pass
