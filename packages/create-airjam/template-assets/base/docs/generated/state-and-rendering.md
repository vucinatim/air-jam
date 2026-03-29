<!-- Generated from content/docs/for-agents/state-and-rendering/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/for-agents/state-and-rendering -->

# State and Rendering

Air Jam projects often combine React, Zustand, per-frame gameplay logic, and sometimes R3F or Three.

That stack works well only when state ownership is explicit.

## Core State Rules

1. keep authoritative gameplay state separate from local UI state
2. avoid one mega store for unrelated concerns
3. use narrow selectors when consuming Zustand state
4. keep store writes intentional and coarse
5. keep per-frame mutable values out of React state when React rendering is not needed

## React Rules

1. do not run simulation through React rerenders
2. keep business logic out of presentational components
3. use refs for hot mutable runtime values
4. keep component boundaries small and purposeful

## R3F and Three Rules

1. avoid rerendering scene components on every frame
2. mutate refs in frame loops when visual updates do not require React state
3. keep rendering integration separate from pure game rules
4. use instancing when repeated objects justify it

## Air Jam Lane Rules

Keep the framework lanes separate:

1. input lane for high-frequency player control input
2. replicated state lane for replayable shared truth
3. signal lane for coarse UX and system events

Do not use replicated store actions as a substitute for per-frame input handling.

## Common Pitfalls

1. putting gameplay logic directly in render components
2. using React state as the simulation engine
3. selecting whole stores across many components
4. mixing debug state into hot runtime paths
5. solving every state problem with more component state
