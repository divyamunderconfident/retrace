import json

import pytest

from examples.research_agent import agent
from retrace import llm
from retrace.recorder import export_run, record


def tool_call(name, arguments, id="c1"):
    return {"role": "assistant", "content": None,
            "tool_calls": [{"id": id, "type": "function", "function": {"name": name, "arguments": arguments}}]}


FINAL = {"role": "assistant", "content": "It is 4."}


@pytest.fixture
def db(tmp_path):
    return tmp_path / "runs.db"


def test_records_every_model_and_tool_step_in_order(fake_llm, db):
    fake_llm.replies = [tool_call("calculator", '{"expression": "2 + 2"}'), FINAL]
    with record(agent.TOOLS, db=db) as run_id:
        agent.run("What is 2 + 2?", model="groq/m")

    steps = json.loads(export_run(run_id, db=db))["steps"]
    assert [(s["index"], s["type"], s["name"]) for s in steps] == [
        (0, "model", "groq/m"), (1, "tool", "calculator"), (2, "model", "groq/m")]

    model, tool, final = steps
    assert model["input"]["model"] == "groq/m"
    assert len(model["input"]["messages"]) == 2  # captured at call time, before the agent appended more
    assert model["output"]["message"]["tool_calls"][0]["function"]["name"] == "calculator"
    assert model["tokens"] == 2
    assert tool["input"] == {"expression": "2 + 2"}
    assert tool["output"] == "4"
    assert tool["tokens"] is None
    assert final["output"]["message"] == FINAL
    assert all(isinstance(s["latency_ms"], int) and s["latency_ms"] >= 0 for s in steps)


def test_tool_error_is_recorded_and_still_raised(fake_llm, db):
    fake_llm.replies = [tool_call("calculator", '{"expression": "1 / 0"}'), FINAL]
    with record(agent.TOOLS, db=db) as run_id:
        _, messages, _ = agent.run("1/0?", model="groq/m")

    assert messages[3]["content"].startswith("Error: ZeroDivisionError")  # the agent still saw the error
    tool = json.loads(export_run(run_id, db=db))["steps"][1]
    assert tool["output"] == {"error": "ZeroDivisionError: division by zero"}


def test_tool_called_with_wrong_argument_is_recorded(fake_llm, db):
    fake_llm.replies = [tool_call("calculator", '{"expr": "2 + 2"}'), FINAL]
    with record(agent.TOOLS, db=db) as run_id:
        agent.run("What is 2 + 2?", model="groq/m")
    tool = json.loads(export_run(run_id, db=db))["steps"][1]
    assert tool["input"] == {"args": [], "kwargs": {"expr": "2 + 2"}}
    assert tool["output"]["error"].startswith("TypeError")


def test_steps_before_a_crash_are_kept_and_the_crash_is_recorded(fake_llm, db):
    fake_llm.replies = [tool_call("calculator", '{"expression": "2 + 2"}'), llm.QuotaExceeded("429")]
    with pytest.raises(llm.QuotaExceeded):
        with record(agent.TOOLS, db=db) as run_id:
            agent.run("What is 2 + 2?", model="groq/m")
    steps = json.loads(export_run(run_id, db=db))["steps"]
    assert [s["type"] for s in steps] == ["model", "tool", "model"]
    assert steps[2]["output"] == {"error": "QuotaExceeded: 429"}
    assert steps[2]["tokens"] is None


def test_originals_are_restored_even_after_an_error(fake_llm, db):
    original_complete, original_tools = llm.complete, dict(agent.TOOLS)
    fake_llm.replies = [llm.QuotaExceeded("429")]
    with pytest.raises(llm.QuotaExceeded):
        with record(agent.TOOLS, db=db):
            assert llm.complete is not original_complete
            assert agent.TOOLS["save_note"].side_effecting is True  # the marker survives wrapping
            agent.run("hi", model="groq/m")
    assert llm.complete is original_complete
    assert agent.TOOLS == original_tools


def test_runs_are_kept_apart(fake_llm, db):
    fake_llm.replies = [FINAL, {"role": "assistant", "content": "Other."}]
    with record(agent.TOOLS, db=db) as first:
        agent.run("one", model="groq/m")
    with record(agent.TOOLS, db=db) as second:
        agent.run("two", model="groq/m")
    assert first != second
    exported = json.loads(export_run(second, db=db))
    assert exported["run_id"] == second
    assert [s["output"]["message"]["content"] for s in exported["steps"]] == ["Other."]


def test_export_unknown_run_raises(db):
    with record({}, db=db):
        pass
    with pytest.raises(KeyError):
        export_run("no-such-run", db=db)
