# Development Loop

Use this as the default implementation loop.

## 1. Pick Scope

1. define the concrete behavior you want to change
2. inspect the current structure before writing code
3. decide whether the task fits the current boundaries or needs a refactor first

## 2. Read The Right Guidance

1. read the relevant local docs page
2. use the Air Jam MCP first when the task fits Air Jam-native devtools flows such as project inspection, logs, or quality gates
3. read the matching skill only if the task fits that skill boundary
4. if the scaffold template includes a concrete example map in its `README.md`, inspect the starter modules it points to before inventing a new location for the work
5. if Claude Code Desktop preview launches the app, use the committed `.claude/launch.json`; for other browser tools that ask for a command, use `pnpm run dev`; do not use raw `vite`
6. after editing host-only runtime refs, physics loops, or `useHostActionListener` side effects, hard refresh the host or run `pnpm exec airjam reset local` if actions appear duplicated or rendered state no longer matches replicated state

## 3. Implement Minimal Correct Changes

1. prefer the smallest safe change
2. do not layer hacks on top of weak structure
3. keep using the established starter module boundaries when they already fit the task
4. refactor first when the current shape is the real problem

## 4. Keep Notes Intentional

1. keep durable notes only when they help the work survive the current chat
2. create a focused plan document only for multi-step work that truly needs it
3. do not add root-level planning files unless the user asks for them

## 5. Validate

Run the checks that match the change:

1. typecheck
2. lint
3. tests
4. build

When the Air Jam MCP is available, prefer its quality-gate tools before ad hoc shell commands.

## 6. Update Contracts

If behavior or canonical patterns changed:

1. update docs in the same change
2. keep examples and scaffolding aligned
3. if you are unsure whether the local AI pack is still aligned with the hosted canonical pack, compare it with `pnpm exec airjam ai-pack status --dir .` or `pnpm exec airjam ai-pack diff --dir .`
4. use `pnpm exec airjam ai-pack update --dir .` only when you explicitly want to replace managed AI pack files such as scaffolded docs, skills, `AGENTS.md`, and other AI-pack-owned guidance; it is not a merge tool and does not own user-created project notes
