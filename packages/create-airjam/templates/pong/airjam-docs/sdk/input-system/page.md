# Input System

The Air Jam input system provides type-safe, validated, and latched input handling. This page explains how input flows from controllers to your game and how to configure it for optimal performance.

## Input Flow

## Configuration

Configure input handling in the `AirJamProvider`:

```tsx filename="src/App.tsx"
import { AirJamProvider } from "@air-jam/sdk";
import { z } from "zod";

// Define your input schema with Zod
const gameInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
  ability: z.boolean(),
  timestamp: z.number(),
});

// Type is automatically inferred
type GameInput = z.infer<typeof gameInputSchema>;

<AirJamProvider
  input={{
    // Schema for validation and type inference
    schema: gameInputSchema,

    // Latching configuration
    latch: {
      booleanFields: ["action", "ability"],
      vectorFields: ["vector"],
    },
  }}
>
  <App />
</AirJamProvider>;
```

## Schema Validation

When you provide a Zod schema, all incoming input is validated:

```tsx
// ✅ Valid input - passes through
{
  vector: { x: 0.5, y: -0.3 },
  action: true,
  ability: false,
  timestamp: 1703123456789
}

// ❌ Invalid input - returns undefined, logs warning
{
  vector: { x: "not a number", y: 0 },  // Type mismatch
  action: true,
  // missing required fields
}
```

**Benefits of Schema Validation:**

- Catch malformed input early
- TypeScript knows exact input shape
- Protect game logic from invalid data
- Helpful development warnings

## Input Latching

### The Problem

Game loops typically run at 60fps, but network events arrive asynchronously. Without latching, quick button taps can be missed:

```
Frame 1: getInput() → action: false
         [Network: action: true arrives]
         [Network: action: false arrives]
Frame 2: getInput() → action: false  ← Tap missed!
```

### The Solution

Latching "holds" true values until they're consumed:

```
Frame 1: getInput() → action: false
         [Network: action: true arrives]
         [Network: action: false arrives]
Frame 2: getInput() → action: true   ← Tap captured!
Frame 3: getInput() → action: false  ← Auto-reset
```

### Boolean Latching

For buttons and triggers:

```tsx filename="src/App.tsx"
latch: {
  booleanFields: ["action", "ability", "jump", "fire"],
}
```

**Behavior:**

- When field becomes `true`, it stays `true` until consumed
- After `getInput()` reads it, it resets to actual current value
- Rapid taps (even between frames) are never missed

### Vector Latching

For joysticks and directional inputs:

```tsx filename="src/App.tsx"
latch: {
  vectorFields: ["vector", "aim", "movement"],
}
```

**Behavior:**

- Non-zero vectors are kept for one frame after release
- Quick stick flicks register in the game loop
- Prevents "dead zone" issues with fast movements

### Example: Without vs With Latching

**Without latching (missed inputs):**

```
Player rapidly taps fire button
Frame 1: action: false (tap happened between frames)
Frame 2: action: false (another tap missed)
Frame 3: action: true  (finally caught one)
Result: Player fires once instead of 3 times
```

**With latching (all inputs captured):**

```
Player rapidly taps fire button
Frame 1: action: true  (first tap latched)
Frame 2: action: true  (second tap latched)
Frame 3: action: true  (third tap latched)
Result: Player fires 3 times as expected
```

## Reading Input

### In the Main Host Component

```tsx filename="src/components/HostView.tsx"
const host = useAirJamHost();

useFrame(() => {
  host.players.forEach((player) => {
    const input = host.getInput(player.id);
    if (!input) return;

    // Input is fully typed!
    movePlayer(player.id, input.vector);

    if (input.action) {
      playerShoot(player.id);
    }
  });
});
```

### In Performance-Critical Components

Use `useGetInput()` to avoid re-renders:

```tsx filename="src/components/Ship.tsx"
import { useGetInput } from "@air-jam/sdk";

const Ship = ({ playerId }: { playerId: string }) => {
  // No store subscription = no re-renders
  const getInput = useGetInput<typeof gameInputSchema>();

  useFrame(() => {
    const input = getInput(playerId);
    // Update ship...
  });

  return <mesh>...</mesh>;
};
```

## Best Practices

### 1. Define Schema Once

Create your schema in a shared file:

```tsx filename="src/game/types.ts"
import { z } from "zod";

export const gameInputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
  ability: z.boolean(),
  timestamp: z.number(),
});

export type GameInput = z.infer<typeof gameInputSchema>;
```

### 2. Latch All Interactive Fields

Always latch buttons and sticks:

```tsx filename="src/App.tsx"
latch: {
  booleanFields: ["action", "ability", "jump", "fire", "menu"],
  vectorFields: ["vector", "aim"],
}
```

### 3. Use Lightweight Hooks in Game Objects

```tsx filename="src/components/Ship.tsx"
// ❌ Don't do this (causes re-renders)
const Ship = () => {
  const host = useAirJamHost(); // Re-renders on connection changes
  // ...
};

// ✅ Do this instead
const Ship = () => {
  const getInput = useGetInput(); // Stable, no re-renders
  // ...
};
```

### 4. Handle Missing Input Gracefully

```tsx filename="src/components/Player.tsx"
const input = getInput(playerId);

// Always check if input exists
if (!input) {
  // Player just connected, input not yet received
  return;
}

// Now safely use input
movePlayer(input.vector);
```

### 5. Include Timestamps for Advanced Physics

```tsx filename="src/game/types.ts"
const inputSchema = z.object({
  // ...
  timestamp: z.number(), // Client-side timestamp
});

// Use for input prediction, lag compensation, etc.
const inputAge = Date.now() - input.timestamp;
```

## Debugging Input

### Console Logging

```tsx filename="src/components/DebugView.tsx"
useFrame(() => {
  const input = getInput(playerId);
  console.log(`Player ${playerId}:`, input);
});
```

### Visual Debug

```tsx filename="src/components/InputDebugger.tsx"
const InputDebugger = ({ playerId }: { playerId: string }) => {
  const getInput = useGetInput();
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const input = getInput(playerId);
      setDisplay(JSON.stringify(input, null, 2));
    }, 100);
    return () => clearInterval(interval);
  }, [playerId, getInput]);

  return <pre style={{ position: "fixed", top: 0, left: 0 }}>{display}</pre>;
};
```

## Common Issues

### Input Not Received

1. **Check connection status:**

   ```tsx filename="src/components/HostView.tsx"
   console.log(host.connectionStatus); // Should be "connected"
   ```

2. **Verify room code matches:**

   ```tsx filename="src/components/HostView.tsx"
   console.log("Host room:", host.roomId);
   // Should match controller's room
   ```

3. **Check schema validation:**
   ```tsx filename="src/components/HostView.tsx"
   // Look for warnings in console:
   // [InputManager] Invalid input for controller XXX: [errors]
   ```

### Input Feels Laggy

1. **Use `useGetInput()` in game objects** (not `useAirJamHost`)
2. **Check network latency** (input includes timestamp)
3. **Verify latching is configured** for buttons/sticks

### Buttons Missed

1. **Enable boolean latching:**

   ```tsx filename="src/App.tsx"
   latch: {
     booleanFields: ["action", "ability"],
   }
   ```

2. **Ensure game loop runs consistently** (60fps target)