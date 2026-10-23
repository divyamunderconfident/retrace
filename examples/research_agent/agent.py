"""Demo research agent: a plain tool-calling loop over llm.complete with three tools."""

import ast
import json
import operator
import re
from pathlib import Path

from retrace import config, llm

HERE = Path(__file__).parent
DOCS_DIR = HERE / "docs"
NOTES_PATH = HERE / "notes.md"
MAX_STEPS = 8

SYSTEM = (
    "You answer questions about the company Brightwater Cycles. "
    "Use search_docs to find facts, calculator for any arithmetic, and save_note only when asked to save something. "
    "Answer only from the documents; if they do not say, say so. Keep the final answer short."
)


def search_docs(query):
    """Return the 5 documents sharing the most words with the query."""
    # shortcut: plain keyword overlap, no stemming or embeddings; upgrade if searches start missing relevant docs.
    words = set(re.findall(r"[a-z0-9]+", query.lower()))
    scored = []
    for path in sorted(DOCS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        score = sum(1 for w in re.findall(r"[a-z0-9]+", text.lower()) if w in words)
        if score:
            scored.append((score, path.name, text))
    scored.sort(key=lambda s: -s[0])
    return "\n\n".join(f"[{name}]\n{text}" for _, name, text in scored[:5]) or "No matching documents."


_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.Mod: operator.mod, ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos,
}


def _eval(node):
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 100:
            raise ValueError("exponent too large")
        return _OPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.operand))
    raise ValueError("only numbers and + - * / % ** ( ) are allowed")


def calculator(expression):
    """Evaluate arithmetic safely: the expression comes from the model, so never use eval()."""
    return str(_eval(ast.parse(expression, mode="eval").body))


def save_note(text):
    with NOTES_PATH.open("a", encoding="utf-8") as f:
        f.write(text.strip() + "\n\n")
    return "Note saved."


save_note.side_effecting = True  # writes to disk; replay must never re-run it (R5)

TOOLS = {"search_docs": search_docs, "calculator": calculator, "save_note": save_note}


def _schema(name, description, param, param_description):
    return {"type": "function", "function": {
        "name": name, "description": description,
        "parameters": {"type": "object", "properties": {param: {"type": "string", "description": param_description}},
                       "required": [param]},
    }}


TOOL_SCHEMAS = [
    _schema("search_docs", "Search the company documents by keywords.", "query", "Keywords to search for"),
    _schema("calculator", "Evaluate an arithmetic expression.", "expression", "For example (4.2 + 5.6) * 2"),
    _schema("save_note", "Save a note for the user. Side effect: writes to the notes file.", "text", "The note"),
]


def run(question, model=config.GROQ_MODEL):
    """Run the loop until the model answers without tool calls. Returns (answer, messages, steps)."""
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    steps = []
    for _ in range(MAX_STEPS):
        out = llm.complete(messages, TOOL_SCHEMAS, model)
        msg = out["message"]
        messages.append(msg)
        steps.append(out)
        if not msg.get("tool_calls"):
            return msg.get("content") or "", messages, steps
        for call in msg["tool_calls"]:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"]["arguments"] or "{}")
                result = TOOLS[name](**args)
            except Exception as e:  # the model sees tool errors and can recover
                result = f"Error: {type(e).__name__}: {e}"
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})
    return f"Stopped after {MAX_STEPS} model calls without a final answer.", messages, steps
