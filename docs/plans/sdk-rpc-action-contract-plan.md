# Air Jam SDK Plan: Narrow Network Action Contract

Last updated: 2026-03-31  
Status: parked

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Work Ledger](../work-ledger.md)
3. [SDK Runtime Ownership Reset Plan (Archived)](../archive/sdk-runtime-ownership-plan-2026-03-31.md)

## Purpose

Tighten the controller-to-host action RPC boundary without overcomplicating the whole store system.

The goal is not to redesign all store actions.

The goal is:

1. make networked actions harder to misuse
2. stop accidental UI/framework objects from leaking over the wire
3. give LLMs a more obvious and safer action shape
4. keep local store ergonomics simple

This should be a narrow transport-contract improvement, not a large abstract action framework.

## Why This Matters

The current action transport is still too permissive at the network boundary.

Today it is too easy for code like this to become a bug:

```tsx
<button onClick={actions.startMatch}>Start</button>
```

If the transport accepts loose variadic args, React event objects or other accidental values can cross the network even though the developer never intended that.

That is a system-design problem, not just an app bug.

This matters more in an LLM-heavy workflow because models naturally:

1. pass raw actions directly to DOM handlers
2. invent positional arguments casually
3. do not reliably distinguish local function calls from network contracts unless the API makes that obvious

## Core Decision

If this work is done, the SDK should adopt one narrow rule for controller-to-host RPC actions:

1. a networked action accepts either no payload or exactly one payload object
2. payloads must be plain JSON-serializable objects
3. variadic positional arguments are not allowed at the network boundary
4. event-like and non-serializable values are rejected
5. runtime context like `controllerId` remains host-side context, not payload

This is the smallest contract that solves the real problem without making the whole SDK feel bureaucratic.

## Important Scope Boundary

This plan is only about the network crossing.

It is **not** proposing that every local store action become schema-driven or wrapped in extra ceremony.

The intended split is:

### Local Actions

Keep simple.

Examples:

1. local UI state
2. internal derived-state transitions
3. host-only local actions that never cross the network

These do not need a special contract system.

### Networked Controller Actions

Make strict.

Examples:

1. `startMatch()`
2. `joinTeam({ team: "solaris" })`
3. `setReady({ ready: true })`

These should follow the zero-or-one-payload-object rule.

## What This Should Not Become

Do not turn this into:

1. a heavy enterprise command framework
2. mandatory Zod schemas for every action on day one
3. a separate complex store-creation API unless it is truly necessary
4. broad compatibility machinery designed around post-v1 migration comfort

Air Jam should stay minimal.

The point is to make the network boundary honest, not to make game code ceremonious.

## Recommended Target Shape

### Baseline Transport Contract

For networked controller actions:

1. `() => void`
2. `(payload: Record<string, unknown>) => void`

Rules:

1. no second positional arg
2. no array/tuple payloads
3. no event-like payloads
4. no functions, class instances, DOM nodes, or other non-serializable values

### Optional Validation Layer

Schema validation should be supported, but not required for the whole feature to be useful.

Good default:

1. strict payload-shape rule by transport
2. optional per-action schema validation where a game wants it

That keeps prototyping light while still improving safety materially.

## Candidate Public API Direction

The simplest acceptable public contract would look like one of these:

### Option A. Keep action definitions mostly as they are, but enforce transport shape

The SDK internally treats networked controller actions as:

1. void
2. single payload object

This is the least disruptive approach.

### Option B. Add a small explicit marker for networked actions

Example shape:

```ts
actions: {
  startMatch: networkAction(() => { ... }),
  joinTeam: networkAction<{ team: TeamId }>((payload) => { ... }),
}
```

This is acceptable only if it stays small and clear.

### Option C. Full contract helper system

Example:

```ts
action.void(...)
action.payload(schema, ...)
```

This should only be chosen if the simpler options prove insufficient.

Current recommendation:

1. start with Option A or a very small Option B
2. do not jump straight to a large helper taxonomy unless there is a concrete need

## Future-Proofing Value

Even the narrow version unlocks real long-term value:

1. safer LLM-generated code
2. clearer docs and examples
3. better transport logs and validation errors
4. cleaner future permissions/policy around action classes
5. easier analytics or inspection of intent-shaped actions later

So this is not just about React click events.
It improves the honesty of the RPC boundary itself.

## Why This Is Still Parked

This is a good architecture improvement, but it is not currently the highest-value prerelease task compared with:

1. finishing the launch-set proof
2. running the remaining hosted-release/media product proof
3. preparing the real release

So the right status for now is:

1. good idea
2. meaningful future value
3. not currently on the critical path

## Implementation Plan

### Phase 1. Freeze The Narrow Contract

Decide and document:

1. networked controller actions are zero-arg or one plain-object payload
2. local-only actions are unaffected
3. `controllerId` stays runtime context, never payload

Done when:

1. the contract is clear enough to document in one short section
2. there is no ambiguity about arrays, tuples, events, or extra args

### Phase 2. Enforce The Transport Boundary

Update the RPC transport so controller-side action forwarding:

1. accepts no payload or one plain object only
2. rejects event-like values
3. rejects non-serializable payloads
4. rejects extra positional args

Done when:

1. accidental DOM event leakage can no longer cross the network
2. controller-to-host RPC is payload-shaped rather than variadic

### Phase 3. Improve Developer Errors

Add high-signal dev diagnostics for:

1. extra positional arguments
2. event-like payloads
3. non-serializable payloads
4. malformed network action invocation

Done when:

1. the error makes it obvious what the developer should do instead
2. debugging does not require reading transport internals

### Phase 4. Add Optional Schema Validation Only If It Stays Small

If it still feels worthwhile after the narrow contract exists:

1. allow optional schema validation for specific networked actions
2. do not require schemas for all actions
3. do not let validation helpers become the dominant public API story

Done when:

1. games that want stronger validation can opt in
2. simple games still feel simple

### Phase 5. Update Template And Docs

Only after the transport contract is stable:

1. update the template to teach void-or-payload-object actions
2. update docs examples accordingly
3. explicitly show correct DOM handler wrapping where needed

Done when:

1. new projects learn the safer pattern by default
2. LLM surface cues point toward the right shape

## Validation

If this work is picked up, the validation bar should include:

1. void network action ignores accidental DOM event args
2. payload network action rejects non-object payloads
3. payload network action rejects event-like payloads
4. malformed payloads do not mutate host state
5. template examples still feel simple and readable

## Closeout Rule

This plan should only move forward if we decide the transport boundary is important enough to tighten before or soon after v1.

If it moves forward, keep it narrow:

1. fix the real network-boundary problem
2. preserve simple local store ergonomics
3. avoid turning the SDK into a more abstract system than the product actually needs
