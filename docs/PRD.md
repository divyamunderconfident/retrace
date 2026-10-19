# PRD — Retrace: a time-travel debugger for AI agents

Retrace records every step of an agent run so a developer can jump to any step, edit what the agent saw, re-run from there, and diff the result against the original. It succeeds if its diff pinpoints the broken step in most seeded failures, and if a model reading Retrace's diff finds the root cause at least twice as often as one reading raw logs. Both are targets to test, not known results.

## Constraints
- Built and tested by one person; no outside participants.
- $0: free model tiers (Groq, Gemini free tier) or a local Ollama model; local storage; public GitHub repo; static site on Vercel Hobby.
- All model calls run locally. The public website only shows saved runs and results; it never calls a model.

## Problem
- Agents fail deep into a run (step 14 of 30), and the evidence is a wall of JSON logs.
- Re-running from scratch costs tokens and time, and the bug may not reproduce because model outputs vary between runs.
- Testing a fix ("what if the tool description were clearer?") means re-running everything and hoping the earlier steps play out the same way.

## Users
- Primary: developers building tool-using agents directly on a model provider's Python SDK.
- Secondary: AI PMs who need to understand why an agent behaved the way it did.

## Goals
- Record any agent run by adding about two lines of code.
- Replay deterministically: unchanged steps return exactly what they returned before, at zero token cost.
- Fork at any step, edit the input, and re-run only from that step onward.
- Diff two runs and highlight the first step where they diverge.

## Non-goals
- Not a hosted observability platform (tracing tools such as Langfuse and LangSmith already cover that).
- No production monitoring, user accounts or team features.
- No support for every agent framework in v1: raw SDK loops only.

Positioning: LangGraph already offers checkpoint-based time travel for agents built in LangGraph. Retrace's angle is framework-agnostic recording of plain SDK loops, plus run diffs and a measured result.

## Requirements
| ID | Requirement | Priority |
| --- | --- | --- |
| R1 | Recorder: wrap the model client and tool functions; log each step's input, output, tokens, cost and latency | P0 |
| R2 | Store runs locally (SQLite) and export a run as JSON | P0 |
| R3 | Replay: serve cached model and tool outputs for unchanged steps, keyed by a hash of the step's input | P0 |
| R4 | Fork: edit a message, tool result or system prompt at step N and re-run live from N onward | P0 |
| R5 | Safety: tools marked as side-effecting are never re-executed during replay | P0 |
| R6 | Web UI: step timeline, step inspector, edit-and-fork panel. Full fork runs locally; the public Vercel demo is a read-only viewer of saved runs and forks | P1 |
| R7 | Diff view: two runs side by side, first divergence highlighted, token and cost delta | P1 |
| R8 | One-click "turn this failing step into a test case" export | P2 |

## Architecture
- Your agent (plain SDK loop) -> Recorder (wraps model client and tools) -> Trace store (SQLite, one row per step; export as JSON).
- Web UI loads runs from the store; the user edits a step and forks.
- Replay engine serves unchanged steps from cache, runs the edited step onward live, and never re-runs side effects.
- Model API and tools are called live only for the forked part of a run.

## Success metrics
- Bug localisation (headline): a script mutates the demo agent to create 20 bugs of 5 kinds (wrong tool argument, truncated context, vague tool description, contradicting instruction, swallowed tool error). Bugs are not hand-picked. Report how often Retrace's diff points to the mutated step.
- Root cause, logs vs Retrace: for each bug, give a model either the raw logs or Retrace's diff report and ask for the root cause; score against the mutation log.
- Replay fidelity: share of unedited steps reproduced byte-identical across 50 recorded runs. Target: 100%.
- Fork savings: tokens spent re-running from step N vs from scratch.
- Dogfooding: 3 short case studies of real bugs hit while building DriftBench and Panel Check, solved with Retrace.

## Milestones
1. Phase 1: recorder and SQLite store working on a demo agent
2. Phase 2: replay engine, fork and side-effect safety, with tests
3. Phase 3: UI designed in Claude Design, built in Next.js, demo deployed on Vercel
4. Phase 4: diff view, the mutation experiments, write-up and demo video

## Risks
- Hidden non-determinism (timestamps, random IDs, changing tool results) breaks replay. Fix: cache everything at the boundary and hash only stable inputs.
- Side effects during replay. Fix: R5 is a must-have, with a test that fails if a side-effecting tool runs during replay.
- Scope creep into a framework. Keep it a recorder plus a viewer; no plugins in v1.

Demo agent: a small research agent that searches a local folder of documents, with calculator and note-taking tools, so it needs no paid search API.
