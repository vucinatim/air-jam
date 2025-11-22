# Physics Movement System Options for Spaceship Controller

## Current Problem
The ship movement is experiencing "springy" behavior and jitter when input changes. This is likely due to force accumulation - forces are being added every frame without being cleared, causing them to stack up.

## Movement System Options

### 1. **Force-Based Movement (Current Approach - Needs Fix)**
**How it works:** Apply continuous forces using `addForce()` every frame.

**Implementation:**
```typescript
// Apply force every frame
body.addForce(forceVector, true);
```

**Benefits:**
- Smooth, realistic acceleration and deceleration
- Natural physics behavior
- Works well with damping for gradual stopping

**Problems:**
- **Forces accumulate** - must clear forces each frame before applying new ones
- Requires careful tuning of force values
- Can cause "springy" behavior if forces aren't reset

**Fix Required:**
```typescript
// Clear forces first, then apply new ones
body.resetForces(true); // Clear accumulated forces
body.addForce(forceVector, true);
```

**Best For:** Realistic spaceship movement with gradual acceleration/deceleration

---

### 2. **Velocity-Based Movement (Recommended for Spaceships)**
**How it works:** Directly set velocity using `setLinvel()` with damping for smooth transitions.

**Implementation:**
```typescript
// Calculate target velocity based on input
const targetVelocity = forwardDirection.multiplyScalar(maxSpeed * input);
const currentVelocity = body.linvel();
// Smoothly interpolate to target velocity
const newVelocity = currentVelocity.lerp(targetVelocity, dampingFactor);
body.setLinvel(newVelocity, true);
```

**Benefits:**
- **No force accumulation issues** - velocity is set directly
- Precise control over speed
- Smooth transitions with damping
- Very responsive
- Commonly used for spaceship/aircraft controllers

**Considerations:**
- Bypasses some physics calculations (but still respects collisions)
- Requires manual damping calculation
- Less "realistic" physics but more predictable

**Best For:** Spaceships, aircraft, or any vehicle needing precise speed control

---

### 3. **Impulse-Based Movement**
**How it works:** Apply instantaneous velocity changes using `applyImpulse()`.

**Implementation:**
```typescript
// Calculate impulse based on delta time
const impulse = forceDirection.multiplyScalar(force * delta);
body.applyImpulse(impulse, true);
```

**Benefits:**
- Immediate response
- Frame-rate independent (when scaled by delta)

**Problems:**
- **Causes jitter** when input changes (instantaneous velocity jumps)
- Not suitable for continuous movement
- Better for discrete actions (jumping, dashing)

**Best For:** Discrete actions like jumps or dashes, NOT continuous movement

---

### 4. **Hybrid: Velocity with Force Damping**
**How it works:** Set target velocity, but use forces for damping/smoothing.

**Implementation:**
```typescript
// Set target velocity
const targetVel = forwardDirection.multiplyScalar(maxSpeed * input);
const currentVel = body.linvel();
const velDiff = targetVel.sub(currentVel);

// Apply damping force to reach target
const dampingForce = velDiff.multiplyScalar(dampingCoefficient);
body.addForce(dampingForce, true);
```

**Benefits:**
- Combines precise control with smooth transitions
- No force accumulation (forces are calculated from velocity difference)
- Very smooth movement

**Best For:** Spaceships needing both precision and smoothness

---

### 5. **Kinematic Controller (Not Suitable)**
**How it works:** Direct position manipulation, bypasses physics.

**Why Not:** Spaceships need physics interactions (collisions, momentum, etc.)

---

## Recommended Solution: Velocity-Based with Damping

For a spaceship controller, **Option 2 (Velocity-Based)** is the most reliable approach:

```typescript
useFrame((state, delta) => {
  if (!rigidBodyRef.current) return;
  const body = rigidBodyRef.current;
  
  // Get input
  const thrust = smoothedInput.y;
  const turnInput = smoothedInput.x;
  
  // Calculate forward direction
  const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
  
  // Calculate target velocity
  const maxSpeed = 10; // Adjust as needed
  const targetVelocity = forward.clone().multiplyScalar(maxSpeed * thrust);
  
  // Get current velocity
  const currentVelocity = new Vector3(
    body.linvel().x,
    body.linvel().y,
    body.linvel().z
  );
  
  // Smoothly interpolate to target velocity
  const dampingFactor = Math.min(1, delta * 8); // Adjust for responsiveness
  const newVelocity = currentVelocity.lerp(targetVelocity, dampingFactor);
  
  // Apply velocity
  body.setLinvel({ x: newVelocity.x, y: 0, z: newVelocity.z }, true);
  
  // Handle rotation similarly
  const targetAngVel = -turnInput * PLAYER_MAX_ANGULAR_VELOCITY;
  const currentAngVel = body.angvel();
  const newAngVel = currentAngVel.y + (targetAngVel - currentAngVel.y) * dampingFactor;
  body.setAngvel({ x: 0, y: newAngVel, z: 0 }, true);
});
```

**Why This Works:**
- No force accumulation - velocity is set directly
- Smooth transitions via lerp
- Predictable and responsive
- Standard approach for vehicle controllers

---

## Alternative: Fix Current Force-Based Approach

If you want to keep force-based movement, you MUST clear forces each frame:

```typescript
useFrame((state, delta) => {
  // CRITICAL: Clear accumulated forces first
  body.resetForces(true);
  body.resetTorques(true);
  
  // Then apply new forces
  body.addForce(forceVector, true);
  body.addTorque(torqueVector, true);
});
```

**The Problem:** Without `resetForces()`, forces accumulate every frame, causing exponential acceleration and "springy" behavior.

---

## Summary Table

| Approach | Smoothness | Responsiveness | Complexity | Force Accumulation Issue |
|----------|-----------|---------------|------------|------------------------|
| Force-Based (Fixed) | ⭐⭐⭐ | ⭐⭐⭐ | Medium | ✅ Fixed with resetForces |
| Velocity-Based | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Low | ✅ No issue |
| Impulse-Based | ⭐⭐ | ⭐⭐⭐⭐⭐ | Low | ✅ No issue (but causes jitter) |
| Hybrid | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | ✅ No issue |

## Why resetForces() Still Causes Jitter

**The Problem:** Even with `resetForces()`, force-based movement can still cause jitter when input changes. This happens because:

1. **Discontinuous Force Application**: When you reset forces to zero and then apply a new force, there's a "step" discontinuity in the force curve. The physics engine sees the force jump from one value to zero, then to a new value, causing a momentary acceleration spike.

2. **Physics Timestep Mismatch**: If the physics engine uses a fixed timestep (default 60Hz) while your rendering runs at a different rate, the force application can be out of sync with the visual updates, causing visible jitter.

3. **Force Integration Artifacts**: The physics engine integrates forces over time. When forces are reset and reapplied every frame, the integration can create small oscillations, especially when input values change rapidly.

**Solutions Found:**
- **Set `timeStep="vary"`** in the Physics component to synchronize physics updates with the rendering frame rate
- **Use velocity-based movement** instead - directly setting velocity avoids force integration artifacts entirely
- **Apply forces with smoothing** - instead of resetting to zero, smoothly transition between force values

**Research Findings:**
According to Rapier/React Three Fiber community discussions, jitter when using `resetForces()` is a known issue. The recommended solutions are:
1. Switch to velocity-based movement (`setLinvel`) for smooth, predictable control
2. Configure Physics with `timeStep="vary"` to match frame rate
3. Use force smoothing/interpolation instead of hard resets

## Recommendation

**Use Velocity-Based Movement (Option 2)** for the spaceship controller. It's the most reliable, predictable, and commonly used approach for vehicle controllers in games. Force-based movement with `resetForces()` can work but requires careful tuning and may still exhibit jitter on input changes.

