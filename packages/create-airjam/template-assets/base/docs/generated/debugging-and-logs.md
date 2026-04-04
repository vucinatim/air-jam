<!-- Generated from content/docs/getting-started/debugging/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/getting-started/debugging -->

# Debugging and Logs

When local Air Jam development breaks, the fastest fix is usually knowing which surface is failing:

1. game host
2. controller
3. local Air Jam server
4. Arcade embed/runtime wiring

This page explains the practical debugging loop.

## The Canonical Stream

Before you start jumping between browser tabs and terminals, remember that Air Jam has one canonical local dev stream:

- [.airjam/logs/dev-latest.ndjson](./unified-dev-logs.md)

That stream is the intended first place to inspect issues that cross:

1. server lifecycle
2. host runtime
3. controller runtime
4. embedded runtime edges

Read the dedicated guide here:

1. [Unified Dev Logs](./unified-dev-logs.md)

## 1. Start With The Canonical Local Loop

For scaffolded games, the default local command is:

```bash
pnpm run dev
```

That gives you the most useful first signal:

1. server logs in the same terminal
2. Vite host output
3. QR/join flow using the same local runtime shape the template expects

If that terminal is not healthy, fix it before debugging the controller UI.

## 2. Check The Local Server First

The local server should answer:

[http://localhost:4000/health](http://localhost:4000/health)

If `/health` is down:

1. your local runtime server is not running
2. the game will not create or join rooms
3. controller QR flow will fail no matter what the UI shows

## 3. Know Which Console To Inspect

Use the right browser console for the right problem:

1. **Host tab** for room creation, host bootstrap, input consumption, and gameplay errors
2. **Controller tab/phone remote inspector** for join failures, input publishing, haptics, and controller UI state
3. **Server terminal** for room lifecycle, socket disconnects, auth/bootstrap problems, and routing issues

Do not debug everything from only one surface.

### Host boots but no room appears

Check:

1. server terminal is running
2. host browser console has no bootstrap/config errors
3. `VITE_AIR_JAM_SERVER_URL` is correct for your environment
4. production/static deploy has a valid `VITE_AIR_JAM_APP_ID`

### Controller cannot join

Check:

1. QR or join URL contains the right room code
2. host and controller are talking to the same server origin
3. SPA rewrites are enabled for `/controller?room=XXXX`
4. phone can actually reach the host URL you are showing

If local phone testing is the issue, use:

```bash
pnpm run dev -- --secure
```

### Input arrives late or not at all

Check:

1. controller is publishing input via `useControllerTick` + `useInputWriter`
2. host is reading input via `getInput` or `useGetInput`
3. you are not trying to send per-frame input through store actions
4. the input schema still matches the payload shape

### Store actions do nothing

Check:

1. actions are dispatched via `useActions()`
2. payloads are plain serializable objects
3. your controller is connected before dispatching
4. identity-dependent actions use `ctx.actorId` on the host side

### Arcade embed works in standalone but breaks in platform

Check:

1. game code is not parsing Arcade runtime params directly
2. gameplay state lives in the game's own store, not in local iframe lifecycle state
3. you are treating the bridge as transport only, not as app-state truth

## 5. Use SDK Diagnostics In Development

Air Jam exposes structured diagnostics for common misuse paths:

```tsx
import {
  onAirJamDiagnostic,
  setAirJamDiagnosticsEnabled,
} from "@air-jam/sdk";

setAirJamDiagnosticsEnabled(true);

const unsubscribe = onAirJamDiagnostic((diagnostic) => {
  console.log(diagnostic.code, diagnostic.message, diagnostic.details);
});
```

This is especially useful for:

1. missing provider/session scope
2. invalid input payload shape
3. state-action dispatch before session readiness
4. runtime config mistakes

## 6. Use The Reference Games As Sanity Checks

If you are unsure whether the framework or your game is the problem, compare your approach against:

1. `pong` for the small canonical starter path
2. `air-capture` for the heavier reference-app path

If your code disagrees with both patterns, your code is probably the outlier.

## 7. Query The Unified Stream

Scaffolded games should use:

```bash
pnpm exec air-jam-server logs
```

Inside the Air Jam monorepo, the equivalent maintainer command is:

```bash
pnpm dev:logs
```

Both commands read the same canonical local observability model.
