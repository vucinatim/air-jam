# Air Jam SDK - DX Refactor Checklist

> **Goal**: Clean, minimal API with the best possible developer experience before public release.
> 
> **Approach**: Complete refactor. No deprecated code, no legacy exports, no backward compatibility baggage.

---

## Target API

After refactor, the SDK exposes **3 primary hooks**:

```typescript
// Host-side (game)
const { 
  roomId,
  joinUrl,
  players,
  connectionStatus,
  gameState,
  getInput,      // Polling for game loops (with optional latching)
  sendSignal,    // Haptics, toasts to controllers
  toggleGameState,
} = useAirJamHost({ 
  roomId?: string,
  input?: {
    schema?: ZodSchema,
    latch?: { booleanFields?: string[], vectorFields?: string[] }
  }
});

// Controller-side (joypad)
const {
  connectionStatus,
  sendInput,
  triggerHaptic,
} = useAirJamController({ roomId });

// Arcade shell (embedding games)
const {
  launchGame,
  closeGame,
  // ...
} = useAirJamShell();
```

---

## 🔴 Phase 1: Core Refactor

### 1. Unify Input Handling in useAirJamHost

**Remove**: `useAirJamInput`, `useAirJamInputLatch` as standalone hooks  
**Add**: Built-in input handling with optional latching in `useAirJamHost`

#### Subtasks

- [ ] **1.1** Create internal `InputManager` class
  - Handles socket listener for `server:input`
  - Manages input buffer (Map per controllerId)
  - Applies Zod validation if schema provided
  - Applies latching if configured
  - Single file: `packages/sdk/src/internal/input-manager.ts`

- [ ] **1.2** Design `InputConfig` interface
  ```typescript
  interface InputConfig<TSchema extends z.ZodSchema = z.ZodSchema> {
    schema?: TSchema;
    latch?: {
      booleanFields?: string[];
      vectorFields?: string[];
    };
  }
  ```

- [ ] **1.3** Update `useAirJamHost` to accept `input` option
  - Create InputManager instance internally
  - Expose `getInput(controllerId)` method
  - Return type inferred from schema: `z.infer<TSchema> | undefined`

- [ ] **1.4** Remove `onInput` callback from `useAirJamHost`
  - Delete `onInputRef` and related code
  - Update `AirJamHostOptions` interface

- [ ] **1.5** Delete standalone input hooks
  - Delete `hooks/use-air-jam-input.ts`
  - Delete `hooks/use-air-jam-input-latch.ts`
  - Remove from `index.ts` exports

---

### 2. Merge useAirJamHostSignal into useAirJamHost

**Remove**: `useAirJamHostSignal` standalone hook  
**Keep**: `sendSignal` already exists in `useAirJamHost`

#### Subtasks

- [ ] **2.1** Delete `hooks/use-air-jam-host-signal.ts`

- [ ] **2.2** Remove from `index.ts` exports

---

### 3. Merge useAirJamHaptics into useAirJamController

**Remove**: `useAirJamHaptics` standalone hook  
**Add**: Haptic methods directly on controller hook

#### Subtasks

- [ ] **3.1** Review `useAirJamHaptics` implementation
  - Understand what it provides

- [ ] **3.2** Add haptic functionality to `useAirJamController`
  - Expose as `triggerHaptic(pattern)` or similar

- [ ] **3.3** Delete `hooks/use-air-jam-haptics.ts`

- [ ] **3.4** Remove from `index.ts` exports

---

## 🟡 Phase 2: Clean Up Exports

### 4. Remove Legacy Code

#### Subtasks

- [ ] **4.1** Delete legacy socket client
  - Delete `socket-client.ts`
  - Remove from `index.ts`

- [ ] **4.2** Audit `state/connection-store.ts`
  - If only used internally by context, don't export
  - If truly unused, delete entirely

- [ ] **4.3** Delete unused internal hooks
  - Check `hooks/internal/use-socket-lifecycle.ts` - still needed?
  - Check `hooks/internal/use-connection-handlers.ts` - still needed?
  - Delete if unused after refactor

- [ ] **4.4** Clean up `index.ts` exports
  - Only export what developers need
  - Group logically: Provider, Hooks, Components, Types, Utilities

---

### 5. Simplify Type Inference

#### Subtasks

- [ ] **5.1** Update `getInput` to infer type from schema automatically
  ```typescript
  // Developer writes:
  const { getInput } = useAirJamHost({
    input: { schema: gameInputSchema }
  });
  const input = getInput(id); 
  // Type is automatically z.infer<typeof gameInputSchema>
  ```

- [ ] **5.2** Remove need for explicit generic parameters
  - Use Zod's type inference everywhere
  - No `<GameInput>` generics needed

---

## 🟢 Phase 3: Update Consumers

### 6. Refactor prototype-game

#### Subtasks

- [ ] **6.1** Update `host-view.tsx`
  - Remove `onInput` callback
  - Use `host.getInput(controllerId)` pattern

- [ ] **6.2** Delete or simplify `useGameInput` hook
  - If only wrapping SDK, delete entirely
  - Ship.tsx should use `host.getInput()` directly

- [ ] **6.3** Remove unused `input-store.ts` from game
  - If input comes directly from SDK, game doesn't need its own store

- [ ] **6.4** Update `game-store.ts`
  - Remove `applyInput` if unused
  - Remove `useInputStore` imports if unused

- [ ] **6.5** Verify controller-view.tsx still works
  - Uses `useAirJamController` - should be unaffected

---

### 7. Update platform app (if applicable)

#### Subtasks

- [ ] **7.1** Check `apps/platform` for SDK usage
  - Update any imports that changed
  - Test joypad page still works

---

## 🔵 Phase 4: Polish

### 8. Final Cleanup

#### Subtasks

- [ ] **8.1** Run TypeScript compiler across all packages
  - `pnpm -r build`
  - Fix any type errors

- [ ] **8.2** Run linter across all packages
  - `pnpm -r lint`
  - Fix any violations

- [ ] **8.3** Delete this checklist file after completion
  - Or move to docs if useful as architecture reference

---

### 9. Documentation

#### Subtasks

- [ ] **9.1** Update SDK README.md
  - New API examples
  - Clear "getting started" section

- [ ] **9.2** Add JSDoc to all public exports
  - Every hook, every option, every return value
  - Include `@example` blocks

- [ ] **9.3** Update SYSTEM_OVERVIEW.md
  - Reflect new simplified architecture

---

## 📊 Implementation Order

| Step | What | Files Changed |
|------|------|---------------|
| 1 | Create InputManager | New: `internal/input-manager.ts` |
| 2 | Update useAirJamHost | `hooks/use-air-jam-host.ts` |
| 3 | Delete standalone input hooks | Delete 2 files |
| 4 | Delete useAirJamHostSignal | Delete 1 file |
| 5 | Merge haptics into controller | `hooks/use-air-jam-controller.ts`, delete 1 file |
| 6 | Clean up legacy exports | `index.ts`, delete files |
| 7 | Update prototype-game | Multiple game files |
| 8 | Update platform app | If needed |
| 9 | Final build & lint | All packages |
| 10 | Documentation | README, JSDoc |

---

## ✅ Definition of Done

- [ ] SDK exports exactly 3 primary hooks: `useAirJamHost`, `useAirJamController`, `useAirJamShell`
- [ ] Input handling (with latching) is built into `useAirJamHost`
- [ ] No standalone `useAirJamInput`, `useAirJamInputLatch`, `useAirJamHostSignal`, `useAirJamHaptics`
- [ ] No legacy exports (`socket-client`, global store)
- [ ] TypeScript infers input types from Zod schema without generics
- [ ] prototype-game works with new API
- [ ] platform app works with new API
- [ ] All packages build without errors
- [ ] All packages lint without errors
- [ ] README documents the new API clearly

---

## Files to Delete

```
packages/sdk/src/
├── hooks/
│   ├── use-air-jam-input.ts         ❌ DELETE
│   ├── use-air-jam-input-latch.ts   ❌ DELETE  
│   ├── use-air-jam-host-signal.ts   ❌ DELETE
│   ├── use-air-jam-haptics.ts       ❌ DELETE (merge into controller)
│   └── internal/
│       ├── use-socket-lifecycle.ts  ❓ DELETE if unused
│       └── use-connection-handlers.ts ❓ DELETE if unused
├── socket-client.ts                  ❌ DELETE (legacy)
```

## Files to Create

```
packages/sdk/src/
├── internal/
│   └── input-manager.ts              ✅ CREATE
```
