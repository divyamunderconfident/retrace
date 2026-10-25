from experiments.mutation_experiment import MUTATIONS, TYPES, score

ROW = {"mutated_step": 3, "type": "swallowed tool error"}


def test_score_needs_exact_step_and_type():
    assert score({"step": 3, "bug_type": "Swallowed tool error "}, ROW) == \
        {"step_correct": True, "type_correct": True, "correct": True}
    assert score({"step": "3", "bug_type": "truncated context"}, ROW)["correct"] is False
    assert score({"step": 2, "bug_type": "swallowed tool error"}, ROW)["correct"] is False


def test_score_handles_unparseable_answers():
    assert score(None, ROW) == {"step_correct": False, "type_correct": False, "correct": False}
    assert score({"bug_type": "swallowed tool error"}, ROW)["step_correct"] is False


def test_two_mutations_per_bug_type():
    assert sorted(m["type"] for m in MUTATIONS) == sorted(TYPES * 2)
