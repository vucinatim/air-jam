---
name: plan-ledger
description: Use when working on non-trivial tasks in an Air Jam project to keep plan.md current, separate active work from future improvements, and record architecture decisions without turning suggestions.md into a task tracker.
---

# Plan Ledger

Use this skill when the work is large enough that progress and decisions should survive the current chat.

## Read First

1. `plan.md`
2. `suggestions.md`
3. `docs/development-loop.md`

## What Goes Where

### `plan.md`

Use for:

1. current goal
2. active checklist
3. progress updates
4. implementation decisions
5. blockers
6. next actions

### `suggestions.md`

Use for:

1. future refactors
2. architecture improvements
3. DX improvements
4. performance follow-ups
5. test gaps that are not part of the current task

## Workflow

1. read `plan.md` before starting meaningful work
2. update it when the implementation approach changes
3. update it when checklist items complete
4. add durable follow-ups to `suggestions.md`
5. keep both files concise and current

## Anti-Patterns

1. using chat history as the only status ledger
2. putting future ideas into the active checklist
3. turning `suggestions.md` into a second `plan.md`
