# Development Loop

Use this as the default implementation loop.

## 1. Pick Scope

1. define the concrete behavior you want to change
2. inspect the current structure before writing code
3. decide whether the task fits the current boundaries or needs a refactor first

## 2. Read The Right Guidance

1. read `plan.md`
2. read the relevant local docs page
3. read the matching skill only if the task fits that skill boundary
4. if the scaffold template includes a concrete example map in its `README.md`, inspect the starter modules it points to before inventing a new location for the work

## 3. Implement Minimal Correct Changes

1. prefer the smallest safe change
2. do not layer hacks on top of weak structure
3. keep using the established starter module boundaries when they already fit the task
4. refactor first when the current shape is the real problem

## 4. Keep The Ledger Current

1. update `plan.md` when starting meaningful work
2. update it again when approach or status changes
3. put future improvements in `suggestions.md`

## 5. Validate

Run the checks that match the change:

1. typecheck
2. lint
3. tests
4. build

## 6. Update Contracts

If behavior or canonical patterns changed:

1. update docs in the same change
2. keep examples and scaffolding aligned
3. if you are unsure whether the local AI pack is still aligned with the hosted canonical pack, compare it with `npx create-airjam ai-pack status --dir .` or `npx create-airjam ai-pack diff --dir .`
4. use `npx create-airjam ai-pack update --dir .` only when you explicitly want to replace managed AI pack files; it is not a merge tool
