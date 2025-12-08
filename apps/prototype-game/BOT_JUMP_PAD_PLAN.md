# Bot Jump Pad Integration Plan

## Problem Statement

Bots currently cannot reach flags or targets that are dropped in the air (above ground level). Jump pads provide a mechanism to gain altitude, but bots don't understand how to use them strategically.

## Goals

1. **Reachability Detection**: Bots should detect when a target is unreachable from their current position
2. **Jump Pad Awareness**: Bots should know where jump pads are located
3. **Strategic Path Planning**: Bots should plan paths that include jump pads when necessary
4. **Seamless Integration**: Solution should fit cleanly into existing Brain & Body architecture

## Architecture Overview

### Current System

- **Brain (FSM)**: High-level decision making (SEARCH, GATHER, ATTACK, etc.)
- **Body (Steering)**: Low-level movement (Seek, Avoid, Separation)
- **GameContext**: Read-only access to game state

### Proposed Extensions

#### 1. GameContext Enhancement

**Location**: `src/game/bot-system/GameContext.ts`

**New Methods**:

```typescript
getJumpPads(): JumpPadInfo[]  // Returns all jump pad positions
findNearestJumpPad(position: Vector3, maxDistance?: number): JumpPadInfo | null
canReachTarget(from: Vector3, to: Vector3): boolean  // Checks if target is reachable
findPathWithJumpPad(from: Vector3, to: Vector3): Path | null  // Returns path including jump pad if needed
```

**JumpPadInfo Interface**:

```typescript
interface JumpPadInfo {
  id: string;
  position: [number, number, number];
  radius: number; // JUMP_PAD_RADIUS (4)
  jumpForce: number; // JUMP_FORCE (25)
}
```

**Rationale**:

- Centralizes jump pad data access
- Provides utility methods for pathfinding
- Maintains separation of concerns

#### 2. Jump Pad Data in Constants

**Location**: `src/game/constants.ts`

**Action**: Move jump pad definitions from `JumpPads.tsx` to `constants.ts` (similar to obstacles)

**Benefits**:

- Single source of truth
- Accessible to both rendering and AI
- Easy to modify/test

**Structure**:

```typescript
export interface JumpPadData {
  id: string;
  position: [number, number, number];
}

export const JUMP_PADS: JumpPadData[] = [
  // ... existing jump pad positions
];
```

#### 3. Reachability System

**Location**: `src/game/bot-system/ReachabilityChecker.ts` (new file)

**Purpose**: Determines if a target is reachable and how to reach it

**Key Concepts**:

- **Vertical Reachability**: Can the bot reach the target's Y coordinate?
- **Jump Pad Trajectory**: Calculate if a jump pad can launch bot to target height
- **Path Validation**: Verify the path is actually traversable

**Methods**:

```typescript
class ReachabilityChecker {
  // Check if target is reachable from current position
  isReachable(from: Vector3, to: Vector3, context: GameContext): boolean;

  // Find jump pad that can help reach target
  findJumpPadForTarget(
    from: Vector3,
    to: Vector3,
    context: GameContext,
  ): JumpPadInfo | null;

  // Calculate if jump pad can launch to target height
  canJumpPadReachHeight(
    jumpPadPos: Vector3,
    targetHeight: number,
    jumpForce: number,
  ): boolean;

  // Estimate trajectory height from jump pad
  estimateJumpHeight(jumpForce: number, initialHeight: number): number;
}
```

**Physics Considerations**:

- Jump pad applies upward velocity of 25 m/s
- Need to account for gravity (-5 m/s² base, up to -15 m/s² when diving)
- Calculate maximum height: `h = v₀² / (2g)` where v₀ = 25, g ≈ 5-15
- With air mode, ships can maintain altitude better

**Implementation Notes**:

- Use conservative estimates (assume worst-case gravity)
- Add safety margin (e.g., if target is at 30m, require jump pad to reach 35m)
- Consider horizontal distance - jump pad must be reasonably close to target

#### 4. Brain State Extensions

**Location**: `src/game/bot-system/BotController.ts` (BotBrain class)

**New State** (Optional):

```typescript
JUMP_TO_TARGET = "JUMP_TO_TARGET"; // Moving to jump pad to reach high target
```

**Alternative Approach** (Recommended):
Instead of a new state, enhance existing states to be "jump pad aware":

- **GATHER**: If collectible is in air → find jump pad → go to jump pad → collect
- **RETRIEVE**: If flag is in air → find jump pad → go to jump pad → retrieve flag
- **CAPTURE**: If flag is in air → find jump pad → go to jump pad → capture flag

**State Flow Enhancement**:

```
Current: GATHER → Move directly to collectible
Enhanced: GATHER → Check reachability → If unreachable → Find jump pad → Go to jump pad → Wait for launch → Continue to collectible
```

**Implementation Strategy**:

1. Before setting target in Brain, check if target is reachable
2. If not reachable and target is above ground:
   - Find nearest jump pad that can reach target
   - Set intermediate target to jump pad
   - Track that we're using a jump pad
3. When near jump pad, align properly and wait for launch
4. After launch, continue to original target

#### 5. Jump Pad Navigation

**Location**: `src/game/bot-system/BotController.ts` (BotBrain class)

**New Fields**:

```typescript
private usingJumpPad: boolean = false;
private jumpPadTarget: Vector3 | null = null;
private originalTarget: Vector3 | null = null;  // Target we're trying to reach after jump
```

**Logic Flow**:

1. **Target Selection**: When selecting a target (flag, collectible, etc.)
   - Check if target Y > current Y + reachability threshold
   - If yes, find appropriate jump pad
   - Set `jumpPadTarget` and `originalTarget`

2. **Jump Pad Approach**:
   - Navigate to jump pad center (within radius)
   - Align ship to be over jump pad
   - Wait for jump pad activation (automatic via collision)

3. **Post-Jump**:
   - Once in air and moving upward, set target back to `originalTarget`
   - Continue normal navigation

**Edge Cases**:

- What if jump pad is on cooldown? → Find next nearest jump pad
- What if multiple jump pads available? → Choose closest to both bot and target
- What if jump pad doesn't reach target? → Try to get as close as possible, then use air mode

#### 6. Body Steering Enhancements

**Location**: `src/game/bot-system/BotController.ts` (BotBody class)

**Jump Pad Alignment**:
When target is a jump pad, add special steering behavior:

- **Precision Landing**: More aggressive seek force when close to jump pad
- **Vertical Alignment**: Ensure ship is at correct height (hover height ~5m)
- **Centering**: Strong attraction to jump pad center when within radius

**New Steering Force** (when using jump pad):

```typescript
calculateJumpPadAlignment(
  position: Vector3,
  jumpPadPos: Vector3,
  jumpPadRadius: number
): Vector3
```

**Behavior**:

- When distance < jumpPadRadius \* 1.5: Strong centering force
- When distance < jumpPadRadius: Very strong centering, reduce forward velocity
- When on jump pad: Minimal movement, wait for launch

#### 7. Integration Points

**Step 1: Extend GameContext**

- Add `getJumpPads()` method
- Add `findNearestJumpPad()` utility
- Move jump pad data to constants

**Step 2: Create ReachabilityChecker**

- Implement reachability detection
- Implement jump pad selection logic
- Add trajectory calculations

**Step 3: Enhance BotBrain**

- Add jump pad awareness to target selection
- Add intermediate target logic (jump pad → final target)
- Track jump pad usage state

**Step 4: Enhance BotBody**

- Add jump pad alignment steering
- Improve precision when approaching jump pads

**Step 5: Testing**

- Test with flags dropped at various heights
- Test with collectibles in air
- Test jump pad selection when multiple options available
- Test edge cases (cooldown, unreachable targets)

## Implementation Details

### Reachability Threshold

```typescript
const REACHABILITY_THRESHOLD = 8; // meters above current position
// If target is more than 8m above bot, consider using jump pad
```

### Jump Pad Selection Algorithm

```typescript
function findBestJumpPad(
  botPos: Vector3,
  targetPos: Vector3,
  jumpPads: JumpPadInfo[],
): JumpPadInfo | null {
  // Filter jump pads that can reach target height
  const viablePads = jumpPads.filter((pad) =>
    canJumpPadReachHeight(pad.position, targetPos.y, JUMP_FORCE),
  );

  if (viablePads.length === 0) return null;

  // Score each jump pad:
  // - Distance from bot (closer = better)
  // - Distance from target (closer = better)
  // - Combined score: (botDist + targetDist) / 2

  return viablePads.reduce((best, pad) => {
    const botDist = botPos.distanceTo(pad.position);
    const targetDist = targetPos.distanceTo(pad.position);
    const score = (botDist + targetDist) / 2;

    const bestBotDist = botPos.distanceTo(best.position);
    const bestTargetDist = targetPos.distanceTo(best.position);
    const bestScore = (bestBotDist + bestTargetDist) / 2;

    return score < bestScore ? pad : best;
  });
}
```

### Jump Pad Approach State Machine

```typescript
enum JumpPadApproachState {
  APPROACHING, // Moving toward jump pad
  ALIGNING, // Centering over jump pad
  WAITING, // On jump pad, waiting for launch
  LAUNCHED, // In air, moving toward original target
}
```

## Testing Strategy

### Unit Tests

- ReachabilityChecker: Test height calculations
- Jump pad selection: Test with various bot/target positions
- Trajectory calculations: Verify physics math

### Integration Tests

- Bot successfully uses jump pad to reach high flag
- Bot selects best jump pad when multiple available
- Bot handles jump pad cooldown gracefully
- Bot continues to target after jump

### Edge Cases

- Target is exactly at reachable height (should not use jump pad)
- All jump pads on cooldown
- Target is above maximum jump height
- Bot is already in air when target is selected

## Performance Considerations

- **Caching**: Cache jump pad positions (they don't change)
- **Lazy Evaluation**: Only check reachability when target Y > threshold
- **Early Exit**: If bot is already in air and above target, skip jump pad logic

## Future Enhancements

1. **Multi-Jump Paths**: Chain multiple jump pads for very high targets
2. **Jump Pad Timing**: Predict when jump pad will be off cooldown
3. **Alternative Routes**: If jump pad unavailable, find alternative path
4. **Jump Pad Blocking**: Use jump pads to block enemy paths

## Summary

This plan provides a clean, extensible solution that:

- ✅ Integrates seamlessly with existing Brain & Body architecture
- ✅ Maintains separation of concerns (GameContext, ReachabilityChecker)
- ✅ Handles edge cases gracefully
- ✅ Is testable and maintainable
- ✅ Doesn't break existing bot behavior
- ✅ Can be implemented incrementally

The key insight is to treat jump pads as **intermediate waypoints** in path planning, rather than special cases. This makes the system more general and easier to extend.

