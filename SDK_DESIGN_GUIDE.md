# SDK Design Guide: The Provider Pattern

This document outlines the high-quality, high-performance bridge between Air Jam and React applications. It moves away from global singletons toward a robust context-bound architecture.

## 🏛️ The Architecture: `AirJamProvider`

The `AirJamProvider` acts as the single source of truth for an Air Jam session. It manages the lifecycle of the Socket.io connection and the Zustand state store.

### 1. Context-Bound State
Instead of a global `useConnectionStore`, we create a store instance **per provider**.

```typescript
// Internal store factory
const createAirJamStore = (initialConfig: Config) => create<AirJamStore>((set) => ({
  // ... state
}));

const AirJamContext = createContext<AirJamStore | null>(null);
```

**Benefits**:
- **Isolation**: Multiple Air Jam instances (e.g., in a dashboard) don't bleed state into each other.
- **SSR Safety**: Avoids state leakage between requests in Next.js/SSR environments.

---

## 🏎️ Performance & Re-rendering

To achieve "Game-Grade" performance, the SDK must not trigger unnecessary React renders.

### 1. Selective Subscription
All hooks use **Zustand selectors** with shallow comparison.
- `useAirJamHost` only re-renders when the `connectionStatus` or `roomId` changes, *not* when someone else's nickname is updated.

### 2. The Intelligent Input API (Zero Re-render)
For high-frequency game loops (60FPS+), we avoid React state for controller inputs.
- **`useAirJamInput`**: Provides a `getController(id)` getter for high-performance state reading.
- **Intelligent Handle**: Returns a handle with `isDown`, `justPressed`, and `vector` helpers.
- **Result**: **0 React renders** during active gameplay, with built-in edge detection.

---

## 🛠️ The "One Correct Way" (Usage Example)

We provide a unified entry point that feels native to modern React.

### Step 1: Wrap your App
```tsx
import { AirJamProvider } from '@air-jam/sdk';

function App() {
  return (
    <AirJamProvider role="host" apiKey="aj_live_...">
      <MyGame />
    </AirJamProvider>
  );
}
```

### Step 2: Use Intelligent Hooks
Hooks automatically detect the nearest `AirJamProvider`.

```tsx
function MyGame() {
  const { getController } = useAirJamInput<MyInput>(); 

  useGameLoop(() => {
    const player = getController(playerId);
    if (player?.justPressed("action")) {
      // Logic for jump/shoot...
    }
  });

  return <div>Playing...</div>;
}
```

---

## 💎 Design Principles for Quality

1.  **Fail Silently & Robustly**: If a Socket disconnects, the SDK should automatically transition to `reconnecting` status without crashing the host app.
2.  **Type-Inference First**: Leverage Zod schemas from the developer's side to provide intellisense for their custom input payloads.
3.  **Explicit over Implicit**: No hidden global state. Everything flows through the `Provider`.
4.  **Auto-Cleanup**: The `Provider`'s `useEffect` cleanup must guarantee the socket is disconnected and the state is reset when the component unmounts.
