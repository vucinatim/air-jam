# Air Jam SDK - Idempotent Host Hook Implementation Plan

> **Goal**: Make `useAirJamHost()` callable from any component inside `<AirJamProvider>`, enabling the simplest possible DX with zero prop drilling.

---

## Target Developer Experience

```tsx
// App.tsx
<AirJamProvider>
  <Game />
</AirJamProvider>

// HostView.tsx (top-level initialization)
const host = useAirJamHost({
  roomId: "ABCD",
  input: { schema: gameInputSchema, latch: { booleanFields: ["action"] } },
  onPlayerJoin: (player) => console.log("Joined:", player),
});

// Ship.tsx (deep in component tree)
const { getInput, sendSignal } = useAirJamHost();  // Just works!

// Collectible.tsx (another deep component)  
const { sendSignal } = useAirJamHost();  // Same shared instance!
```

**One hook. Use it anywhere. That's it.**

---

## Current Architecture (Problem)

```
AirJamProvider
  └── store (zustand) - connection state
  └── socketManager - socket instances
  
useAirJamHost (called once)
  └── Creates InputManager instance locally
  └── Sets up socket listeners
  └── Returns { getInput, sendSignal, players, ... }
  └── Must pass these as props to children
```

**Problems:**
1. `InputManager` created inside hook - not shared
2. Calling `useAirJamHost()` twice creates duplicate InputManagers
3. Forces prop drilling or custom contexts in games

---

## Target Architecture (Solution)

```
AirJamProvider
  └── store (zustand) - connection state + host state
  └── socketManager - socket instances  
  └── hostState (new) - shared host state including InputManager
  
useAirJamHost (callable anywhere)
  └── First call with options → initializes hostState
  └── Subsequent calls → reads from hostState
  └── All callers get same { getInput, sendSignal, players, ... }
```

---

## Implementation Steps

### Phase 1: Extend SDK Context

#### 1.1 Add Host State to Connection Store

**File:** `packages/sdk/src/state/connection-store.ts`

Add to store interface:
```typescript
interface AirJamStore {
  // ... existing fields ...
  
  // Host state (shared across all useAirJamHost calls)
  hostInitialized: boolean;
  inputManager: InputManager | null;
  hostOptions: AirJamHostOptions | null;
  
  // Actions
  initializeHost: (options: AirJamHostOptions, inputManager: InputManager) => void;
  getHostInputManager: () => InputManager | null;
}
```

#### 1.2 Update Store Implementation

```typescript
export const createAirJamStore = () => create<AirJamStore>((set, get) => ({
  // ... existing fields ...
  
  hostInitialized: false,
  inputManager: null,
  hostOptions: null,
  
  initializeHost: (options, inputManager) => {
    set({ 
      hostInitialized: true, 
      inputManager,
      hostOptions: options,
    });
  },
  
  getHostInputManager: () => get().inputManager,
}));
```

---

### Phase 2: Make useAirJamHost Idempotent

#### 2.1 Refactor useAirJamHost Logic

**File:** `packages/sdk/src/hooks/use-air-jam-host.ts`

```typescript
export const useAirJamHost = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options?: AirJamHostOptions<TSchema>,
): AirJamHostApi<TSchema> => {
  const { config, store, getSocket, disconnectSocket } = useAirJamContext();
  
  // Check if already initialized
  const hostInitialized = useStore(store, (s) => s.hostInitialized);
  const storedInputManager = useStore(store, (s) => s.inputManager);
  
  // Get or create InputManager
  const inputManager = useMemo(() => {
    if (storedInputManager) {
      // Already initialized - reuse existing
      return storedInputManager;
    }
    if (!options?.input) {
      // No input config - no InputManager needed
      return null;
    }
    // First call with input config - create and store
    const manager = new InputManager(options.input);
    return manager;
  }, [storedInputManager, options?.input]);
  
  // Initialize on first call with options
  useEffect(() => {
    if (!hostInitialized && options && inputManager) {
      store.getState().initializeHost(options, inputManager);
    }
  }, [hostInitialized, options, inputManager, store]);
  
  // ... rest of hook logic uses inputManager from store ...
  
  const getInput = useCallback(
    (controllerId: string) => inputManager?.getInput(controllerId),
    [inputManager]
  );
  
  // ... return API ...
};
```

#### 2.2 Key Behavior Changes

| Scenario | Before | After |
|----------|--------|-------|
| First call with options | Creates InputManager locally | Creates InputManager, stores in context |
| Second call with options | Creates ANOTHER InputManager (bug!) | Reuses stored InputManager, ignores duplicate options |
| Call without options | Fails (required params missing) | Reads from stored state (works!) |
| Call before initialization | N/A | Returns partial state with warnings |

---

### Phase 3: Update InputManager Storage

#### 3.1 Move InputManager to Context

**Current:** InputManager created in useAirJamHost, stored in local ref
**New:** InputManager stored in zustand store, shared across components

#### 3.2 Socket Listener Management

The InputManager needs the socket to listen for `server:input` events.

**Option A:** Pass socket to InputManager constructor
```typescript
const inputManager = new InputManager(options.input, socket);
```

**Option B:** InputManager uses context to get socket
```typescript
class InputManager {
  constructor(config, getSocket: () => AirJamSocket) {
    this.getSocket = getSocket;
  }
}
```

**Recommendation:** Option A is simpler and more explicit.

---

### Phase 4: Handle Edge Cases

#### 4.1 Multiple Calls with Different Options

```typescript
// HostView.tsx
useAirJamHost({ input: { schema: schemaA } });

// SomeOtherComponent.tsx  
useAirJamHost({ input: { schema: schemaB } });  // Different schema!
```

**Behavior:** Log warning, use first initialization's options.

```typescript
if (hostInitialized && options) {
  console.warn(
    '[useAirJamHost] Host already initialized. Options from subsequent calls are ignored. ' +
    'Initialize once at the top level of your app.'
  );
}
```

#### 4.2 Call Without Prior Initialization

```typescript
// Ship.tsx (no parent called useAirJamHost with options yet)
const { getInput } = useAirJamHost();  // What happens?
```

**Behavior:** Return safe defaults, log warning in dev.

```typescript
if (!hostInitialized) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[useAirJamHost] No host initialization found. ' +
      'Call useAirJamHost({ input: {...} }) in a parent component first.'
    );
  }
  // Return safe API with no-op functions
  return {
    getInput: () => undefined,
    sendSignal: () => {},
    // ... other safe defaults
  };
}
```

#### 4.3 Cleanup on Unmount

When the initializing component unmounts, should we clean up?

**Recommendation:** NO. Keep state alive for the lifetime of AirJamProvider.
- Host state should persist even if the initializing component remounts
- Only clean up when AirJamProvider unmounts

---

### Phase 5: Update Prototype Game

#### 5.1 Files to Delete

```
apps/prototype-game/src/game/
├── context/
│   ├── input-context.tsx    ❌ DELETE
│   └── signal-context.tsx   ❌ DELETE
```

#### 5.2 Files to Simplify

**GameScene.tsx** - Remove provider wrapping:
```tsx
// Before
<InputProvider getInput={getInput}>
  <SignalProvider sendSignal={sendSignal}>
    {content}
  </SignalProvider>
</InputProvider>

// After
{content}
```

Remove props from GameScene:
```tsx
// Before
export function GameScene({ onCamerasReady, getInput, sendSignal }) { ... }

// After  
export function GameScene({ onCamerasReady }) { ... }
```

**host-view.tsx** - Remove prop passing:
```tsx
// Before
<GameScene getInput={host.getInput} sendSignal={host.sendSignal} />

// After
<GameScene />
```

#### 5.3 Files to Update

**Ship.tsx:**
```tsx
// Before
import { useSignalContext } from "../context/signal-context";
import { useGameInput } from "../hooks/useGameInput";

const sendSignal = useSignalContext();
const { popInput } = useGameInput();

// After
import { useAirJamHost } from "@air-jam/sdk";

const { getInput, sendSignal } = useAirJamHost();
```

**useGameInput.ts** - Simplify to only handle bots:
```tsx
// Before: Reads from custom context, handles bots
// After: Just handles bot input logic

export const useGameInput = () => {
  const { getInput } = useAirJamHost();
  const botManager = useBotManager.getState();
  
  const popInput = (controllerId: string) => {
    if (controllerId.startsWith("bot-")) {
      return botManager.getBotInput(controllerId, ...);
    }
    return getInput(controllerId);
  };
  
  return { popInput };
};
```

---

## Implementation Checklist

### SDK Changes

- [ ] **1.1** Add `hostInitialized`, `inputManager`, `hostOptions` to connection store
- [ ] **1.2** Add `initializeHost()` action to store
- [ ] **2.1** Refactor useAirJamHost to check for existing initialization
- [ ] **2.2** Store InputManager in context on first call with options
- [ ] **2.3** Reuse stored InputManager on subsequent calls
- [ ] **2.4** Handle calls without options (read-only mode)
- [ ] **3.1** Update InputManager to accept socket in constructor
- [ ] **4.1** Add warning for duplicate initialization with different options
- [ ] **4.2** Add warning for calls before initialization (dev only)
- [ ] **4.3** Verify cleanup behavior on provider unmount

### Prototype Game Changes

- [ ] **5.1** Delete `context/input-context.tsx`
- [ ] **5.2** Delete `context/signal-context.tsx`
- [ ] **5.3** Remove props from GameScene component
- [ ] **5.4** Remove provider wrapping in GameScene
- [ ] **5.5** Update Ship.tsx to use `useAirJamHost()` directly
- [ ] **5.6** Update any other components using contexts
- [ ] **5.7** Simplify useGameInput.ts (bot logic only)
- [ ] **5.8** Test full game flow works

### Verification

- [ ] Build SDK without errors
- [ ] Build prototype-game without errors
- [ ] Test: Input works in Ship component
- [ ] Test: Signals work (haptics, toasts)
- [ ] Test: Multiple components can call useAirJamHost()
- [ ] Test: React Strict Mode double-mount works

---

## API Documentation (Post-Implementation)

### useAirJamHost

```typescript
function useAirJamHost<TSchema extends z.ZodSchema>(
  options?: AirJamHostOptions<TSchema>
): AirJamHostApi<TSchema>;
```

**Usage Patterns:**

```tsx
// Pattern 1: Initialize with options (call once, typically in HostView)
const host = useAirJamHost({
  roomId: "ABCD",
  input: {
    schema: gameInputSchema,
    latch: { booleanFields: ["action", "ability"] }
  },
  onPlayerJoin: (player) => { ... },
});

// Pattern 2: Read-only access (call anywhere after initialization)
const { getInput, sendSignal, players } = useAirJamHost();

// Pattern 3: Partial access (destructure only what you need)
const { sendSignal } = useAirJamHost();  // Just need signals
const { players } = useAirJamHost();     // Just need player list
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `roomId` | `string` | Current room code |
| `joinUrl` | `string` | URL for controllers to join |
| `players` | `PlayerProfile[]` | Connected players |
| `connectionStatus` | `ConnectionStatus` | Connection state |
| `gameState` | `GameState` | Playing/paused state |
| `getInput` | `(id: string) => Input` | Get input for controller |
| `sendSignal` | `(type, payload, id?) => void` | Send signal to controller(s) |
| `toggleGameState` | `() => void` | Toggle play/pause |

---

## Summary

This refactor achieves:

1. ✅ **One hook** - `useAirJamHost()` is the only host-side hook
2. ✅ **Use anywhere** - Works in any component inside AirJamProvider
3. ✅ **No prop drilling** - No passing getInput/sendSignal through props
4. ✅ **No custom contexts** - Games don't need InputProvider/SignalProvider
5. ✅ **Idempotent** - Safe to call multiple times
6. ✅ **Type-safe** - Schema inference still works
7. ✅ **Clean game code** - Ship.tsx just imports and uses the SDK hook
