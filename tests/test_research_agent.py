import pytest

from examples.research_agent import agent


def tool_call(name, arguments, id="c1"):
    return {"role": "assistant", "content": None,
            "tool_calls": [{"id": id, "type": "function", "function": {"name": name, "arguments": arguments}}]}


def test_calculator_does_arithmetic():
    assert agent.calculator("(4.2 + 5.6) * 2") == "19.6"
    assert agent.calculator("-3 ** 2") == "-9"


@pytest.mark.parametrize("expr", ["__import__('os').system('echo hi')", "open('x')", "2 ** 1000", "x + 1"])
def test_calculator_rejects_anything_but_arithmetic(expr):
    with pytest.raises(ValueError):
        agent.calculator(expr)


def test_search_finds_the_relevant_doc():
    assert agent.search_docs("Ridgeline recall battery").startswith("[11-recall-2025.md]")
    assert agent.search_docs("zzzz") == "No matching documents."


def test_save_note_is_marked_side_effecting(monkeypatch, tmp_path):
    monkeypatch.setattr(agent, "NOTES_PATH", tmp_path / "notes.md")
    assert agent.save_note.side_effecting is True
    agent.save_note("hello")
    assert (tmp_path / "notes.md").read_text() == "hello\n\n"


def test_loop_runs_tools_until_final_answer(fake_llm):
    fake_llm.replies = [tool_call("calculator", '{"expression": "2 + 2"}'),
                        {"role": "assistant", "content": "It is 4."}]
    answer, messages, steps = agent.run("What is 2 + 2?", model="groq/m")
    assert answer == "It is 4."
    assert messages[3] == {"role": "tool", "tool_call_id": "c1", "content": "4"}
    assert len(steps) == 2


def test_tool_errors_go_back_to_the_model(fake_llm):
    fake_llm.replies = [tool_call("calculator", '{"expression": "1 / 0"}'), {"role": "assistant", "content": "Cannot."}]
    _, messages, _ = agent.run("1/0?", model="groq/m")
    assert messages[3]["content"].startswith("Error: ZeroDivisionError")


def test_loop_stops_after_max_steps(fake_llm):
    fake_llm.replies = [tool_call("calculator", '{"expression": "1"}', id=f"c{i}") for i in range(agent.MAX_STEPS)]
    answer, _, steps = agent.run("loop forever", model="groq/m")
    assert answer.startswith("Stopped after") and len(steps) == agent.MAX_STEPS
