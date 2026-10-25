import json

import pytest

from examples.research_agent import agent
from retrace import config, llm
from retrace.diff import diff, diff_report
from retrace.recorder import record
from retrace.replay import fork


def tool_call(name, arguments, id="c1"):
    return {"role": "assistant", "content": None,
            "tool_calls": [{"id": id, "type": "function", "function": {"name": name, "arguments": json.dumps(arguments)}}]}


def answer(text):
    return {"role": "assistant", "content": text}


@pytest.fixture
def db(tmp_path):
    return tmp_path / "runs.db"


@pytest.fixture
def base(fake_llm, db):
    """A recorded run: model -> calculator -> model."""
    fake_llm.replies = [tool_call("calculator", {"expression": "2 + 2"}), answer("It is 4.")]
    with record(agent.TOOLS, db=db) as run_id:
        agent.run("2+2?", model="groq/m")
    return run_id


def test_identical_runs_have_no_divergence(fake_llm, db, base):
    fake_llm.replies = [tool_call("calculator", {"expression": "2 + 2"}), answer("It is 4.")]
    with record(agent.TOOLS, db=db) as again:
        agent.run("2+2?", model="groq/m")
    d = diff(base, again, db=db)
    assert d["first_divergence"] is None and d["changes"] == []
    assert d["tokens"] == {"a": 4, "b": 4, "delta": 0}
    assert "identical" in diff_report(d)


def test_edited_tool_output_is_the_first_divergence(fake_llm, db, base):
    fake_llm.replies = [answer("It is 5.")]
    with fork(base, step=1, edit=lambda out: "5", tools=agent.TOOLS, db=db) as forked:
        agent.run("2+2?", model="groq/m")
    d = diff(base, forked, db=db)
    assert d["first_divergence"] == 1
    assert d["kind"] == "output"
    assert (d["step_a"]["type"], d["step_a"]["name"]) == ("tool", "calculator")
    assert d["changes"] == [{"path": "output", "a": "4", "b": "5"}]
    report = diff_report(d)
    assert "First divergence: step 1 (tool calculator), output changed" in report
    assert "output: '4' -> '5'" in report


def test_changed_system_prompt_diverges_at_step_0_with_the_path(fake_llm, db, base):
    def brief(inp):
        return {**inp, "messages": [{"role": "system", "content": "Be brief."}] + inp["messages"][1:]}

    fake_llm.replies = [answer("4")]
    with fork(base, step=0, edit=brief, tools=agent.TOOLS, db=db) as forked:
        agent.run("2+2?", model="groq/m")
    d = diff(base, forked, db=db)
    assert (d["first_divergence"], d["kind"]) == (0, "input")
    assert d["changes"][0]["path"] == "input.messages[0].content"
    assert d["changes"][0]["b"] == "Be brief."
    assert (d["steps_a"], d["steps_b"]) == (3, 1)
    assert d["tokens"] == {"a": 4, "b": 2, "delta": -2}


def test_a_run_that_ends_early_diverges_at_its_first_missing_step(db, base):
    with record(agent.TOOLS, db=db) as prefix:  # only the first model call, same input, served by llm.py's cache
        llm.complete([{"role": "system", "content": agent.SYSTEM}, {"role": "user", "content": "2+2?"}],
                     agent.TOOL_SCHEMAS, "groq/m")
    d = diff(base, prefix, db=db)
    assert (d["first_divergence"], d["kind"]) == (1, "missing")
    assert d["step_b"] is None and d["step_a"]["name"] == "calculator"
    assert "missing in run b" in diff_report(d)


def test_failed_step_diverges_on_output(monkeypatch, fake_llm, db, base, tmp_path):
    monkeypatch.setattr(llm, "CACHE_DIR", tmp_path / "fresh")  # force real (fake) calls for the same inputs
    fake_llm.replies = [tool_call("calculator", {"expression": "2 + 2"}), llm.QuotaExceeded("429")]
    with pytest.raises(llm.QuotaExceeded):
        with record(agent.TOOLS, db=db) as crashed:
            agent.run("2+2?", model="groq/m")
    d = diff(base, crashed, db=db)
    assert (d["first_divergence"], d["kind"]) == (2, "output")
    assert {"path": "output.error", "a": "<missing>", "b": "QuotaExceeded: 429"} in d["changes"]


def test_cost_uses_configured_prices(monkeypatch, fake_llm, db, base):
    monkeypatch.setitem(config.PRICE_PER_MILLION_TOKENS, "groq", 1_000_000.0)  # $1 per token, easy to check
    d = diff(base, base, db=db)
    assert d["cost_usd"] == {"a": 4.0, "b": 4.0, "delta": 0.0}
