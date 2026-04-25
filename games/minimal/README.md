# Air Jam Minimal Template

The smallest possible Air Jam game. Everyone who joins gets a big TAP button
on their phone; every tap bumps a shared count shown huge on the host screen.

Use this template when you want a clean slate to build on.

## What's here

```
src/
├── airjam.config.ts   # game metadata plus SDK runtime/controller/input config
├── main.tsx           # React entry — mounts <BrowserRouter> and <App>
├── app.tsx            # Routes: "/" → host, "/controller" → controller
├── game/
│   ├── input.ts       # Controller → host input schema (empty here)
│   └── store.ts       # Networked state + actions (the tap counter)
├── host/
│   └── index.tsx      # What the TV shows
└── controller/
    └── index.tsx      # What a phone shows
```

That's the whole game. About 150 lines of actual TypeScript across the three
files in `game/`, `host/`, and `controller/`.

## Three lanes, only two used

The SDK offers three ways to move data between the host and controllers:

| Lane   | What it's for                             | Used here?                    |
| ------ | ----------------------------------------- | ----------------------------- |
| State  | Replicated store + host-authoritative RPC | Yes — `useMinimalStore`       |
| Signal | Out-of-band UX (haptics, toasts)          | No — keep this starter simple |
| Input  | High-frequency per-frame controller input | No — taps are discrete events |

When you need continuous controller input (joystick, paddle, motion),
`useInputWriter` / `useControllerTick` on the controller + `host.getInput()`
on the host is the pattern. See the `pong` template for a worked example.

## Run it

```bash
pnpm install
pnpm dev
```

Then open the printed URL on a laptop (host) and scan the QR on your phone
(controller).

## Extend it

Good places to grow from here:

1. **Add a game phase.** Replace the flat counter with a 30-second round: add
   `matchPhase: "lobby" | "playing" | "ended"` to the store, a countdown on
   the host, and a disabled state on the controller between rounds.
2. **Add real input.** Turn the button into a held accelerator: populate
   `gameInputSchema` with a `held: boolean`, publish it with
   `useInputWriter`, and read it on the host with `host.getInput(playerId)`.
3. **Add per-player identity.** `controller.selfPlayer` exposes the connected
   player profile (name, color). Show it on both surfaces. Plug
   `ControllerPlayerNameField` into the controller for editable names.
4. **Add a toast.** Use `useSendSignal()` on the host and call
   `sendSignal("TOAST", { message: "…" })` to show a banner on controllers —
   good for round results.

When any of those grow, look at `pong` as a reference for the same primitives
in a fuller shape.
