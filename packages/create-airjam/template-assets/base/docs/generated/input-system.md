<!-- Generated from content/docs/sdk/input-system/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/sdk/input-system -->

# Input System

The Air Jam input system provides type-safe, validated controller input with clear behavior semantics.

## Configuration

Configure input in your canonical Air Jam app setup:

```tsx filename="src/airjam.config.ts"
import { createAirJamApp, env } from "@air-jam/sdk";
import { z } from "zod";

const gameInputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
  ability: z.boolean(),
  timestamp: z.number(),
});

type GameInput = z.infer<typeof gameInputSchema>;

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input={{
    schema: gameInputSchema,
  },
});
```

## Default Behavior (No Extra Config)

Without any `input.behavior` overrides:

- booleans use `pulse` (tap-safe consume-on-read)
- vectors use `latest` (continuous current value)
- all other fields use `latest`

This default is the canonical path for most games.

## Optional Behavior Overrides

Use `input.behavior` only when your game has specialized needs.

```tsx filename="src/airjam.config.ts"
export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input={{
    schema: gameInputSchema,
    behavior: {
      pulse: ["action", "ability"],
      latest: ["vector"],
      hold: ["menuVector"],
    },
  }}
})
```

Behavior modes:

- `pulse`: consume-on-read, ideal for one-shot actions (jump/fire/confirm)
- `latest`: current value only, ideal for movement sticks
- `hold`: vectors keep last non-zero direction until next non-zero value

## Migration From `latch`

Old config:

```tsx
input={{
  schema: gameInputSchema,
  latch: {
    booleanFields: ["action"],
    vectorFields: ["vector"],
  },
}}
```

New config:

```tsx
input={{
  schema: gameInputSchema,
  behavior: {
    pulse: ["action", "vector"],
  },
}}
```

For most games, remove the override entirely and keep `input: { schema }`.

## Schema Validation

When you provide a Zod schema, incoming input is validated before your game reads it.

```tsx
// ✅ valid input
{
  vector: { x: 0.5, y: -0.3 },
  action: true,
  ability: false,
  timestamp: 1703123456789,
}

// ❌ invalid input (returns undefined + warning)
{
  vector: { x: "bad", y: 0 },
  action: true,
}
```

Benefits:

- typed `getInput()` values
- malformed payloads blocked before gameplay logic
- clear runtime warnings during development

### Main Host Loop

This example uses the starter host surface path.
Treat it as a recommended default, not a required filename.

```tsx filename="src/host/index.tsx"
const host = useAirJamHost();

useFrame(() => {
  host.players.forEach((player) => {
    const input = host.getInput(player.id);
    if (!input) return;

    movePlayer(player.id, input.vector);

    if (input.action) {
      playerShoot(player.id);
    }
  });
});
```

### Performance-Critical Components

Use `useGetInput()` to avoid store-driven re-renders:

```tsx filename="src/game/components/ship.tsx"
import { useGetInput } from "@air-jam/sdk";

const Ship = ({ playerId }: { playerId: string }) => {
  const getInput = useGetInput<typeof gameInputSchema>();

  useFrame(() => {
    const input = getInput(playerId);
    if (!input) return;

    shipRef.current.position.x += input.vector.x * SPEED;
    shipRef.current.position.y += input.vector.y * SPEED;
  });

  return <mesh ref={shipRef}>...</mesh>;
};
```

## Controller Cadence

Use `useInputWriter()` with `useControllerTick()` for fixed-cadence publishing:

This example uses the starter controller surface path.

```tsx filename="src/controller/index.tsx"
import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { useRef } from "react";

const ControllerView = () => {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const directionRef = useRef(0);

  useControllerTick(
    () => {
      writeInput({
        direction: directionRef.current,
        action: false,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.gameState === "playing",
      intervalMs: 16,
    },
  );
};
```

### 1. Keep Input and State in Separate Lanes

- Input lane: `useInputWriter` + `getInput` / `useGetInput`
- State lane: `createAirJamStore` + `useActions`

Do not send per-frame analog input via store actions.

### 2. Keep Quickstart Config Minimal

Start with `input: { schema }`. Add `input.behavior` only for non-default needs.

### 3. Handle Missing Input Gracefully

```tsx filename="src/components/Player.tsx"
const input = getInput(playerId);
if (!input) return;

movePlayer(input.vector);
```

### 4. Include Timestamps for Advanced Physics

```tsx filename="src/game/types.ts"
const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
  timestamp: z.number(),
});

const inputAge = Date.now() - input.timestamp;
```

### Input Not Received

1. Check host connection status (`connected`)
2. Verify room code matches on host and controller
3. Check schema warnings in console (`[InputManager] Invalid input ...`)

### Input Feels Laggy

1. Use `useGetInput()` inside game objects
2. Verify your controller tick cadence (typically `16ms`)
3. Check network latency (include timestamps in schema)

### Buttons Feel Unreliable

1. Confirm the field is boolean in your schema
2. Keep default behavior (`pulse`) for action buttons
3. Avoid dispatching button presses through store actions
