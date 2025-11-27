import type { GameLoopInput } from "@air-jam/sdk";
import { Vector3 } from "three";
import { shipPositions, shipRotations } from "../components/Ship";

export class BotController {
  private controllerId: string;
  private targetPosition: Vector3 | null = null;
  private lastActionTime = 0;
  private changeTargetTime = 0;

  constructor(controllerId: string) {
    this.controllerId = controllerId;
  }

  update(_delta: number, time: number): GameLoopInput {
    // 1. Get current bot state
    const currentPos = shipPositions.get(this.controllerId);
    const currentRot = shipRotations.get(this.controllerId);

    if (!currentPos || !currentRot) {
      // If we don't have position yet (spawn frame), just wait
      return {
        vector: { x: 0, y: 0 },
        action: false,
        ability: false,
        timestamp: time,
      };
    }

    // 2. Determine Target
    if (!this.targetPosition || time > this.changeTargetTime) {
      // Pick a random point in the arena (approx +/- 100 units)
      this.targetPosition = new Vector3(
        (Math.random() - 0.5) * 200,
        10 + Math.random() * 20, // Height between 10 and 30
        (Math.random() - 0.5) * 200
      );
      this.changeTargetTime = time + 5 + Math.random() * 5; // Change every 5-10 seconds
    }

    // 3. Calculate Steering
    // Vector to target
    const toTarget = this.targetPosition.clone().sub(currentPos);
    
    // Transform to local space to decide turn direction
    // We need to know if target is left or right of us
    // Inverse rotation applied to the vector gives us the vector relative to the ship's nose
    const localToTarget = toTarget.clone().applyQuaternion(currentRot.clone().invert());

    // x > 0 means target is to the right, x < 0 means left
    // z < 0 means target is in front, z > 0 means behind
    
    let turnInput = 0;
    if (localToTarget.x > 5) turnInput = -1; // Turn Right (negative x input usually means right in this game? Let's check Ship.tsx)
    else if (localToTarget.x < -5) turnInput = 1; // Turn Left
    
    // Wait, let's verify Ship.tsx turn logic
    // Ship.tsx: const target = -input * PLAYER_MAX_ANGULAR_VELOCITY;
    // So if input is positive, target is negative (Right turn in standard math? No, usually Y rotation: Left is positive)
    // Let's assume standard: Positive Input -> Negative Yaw -> Right Turn?
    // Let's stick to: Input X = -1 (Left) to 1 (Right)
    // If localToTarget.x is positive (Right), we want to turn Right.
    // If input 1 means Right, then turnInput = 1.
    
    // Let's re-read Ship.tsx:
    // const turnInput = smoothedInputRef.current.x;
    // const newYawVel = calculateYaw(..., turnInput, ...);
    // function calculateYaw(..., input, ...) { const target = -input * PLAYER_MAX_ANGULAR_VELOCITY; }
    // If input is 1.0: target = -MAX_VEL. Negative Yaw velocity usually means turning Right (clockwise from top).
    // So Input 1.0 = Turn Right.
    // If localToTarget.x > 0 (Target is Right), we want Input > 0.
    
    const distance = toTarget.length();
    const normalizedX = localToTarget.x / distance; // -1 to 1 roughly
    
    // Simple P-controller for steering
    turnInput = Math.max(-1, Math.min(1, normalizedX * 5));

    // 4. Calculate Thrust
    // If we are facing roughly the target, thrust!
    // If we are far away, thrust!
    // If we are close, maybe slow down?
    
    // Check if target is in front (local z is negative for forward usually in Three.js)
    // Ship.tsx: const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
    // Yes, Forward is -Z.
    
    let thrustInput = 0;
    if (localToTarget.z < 0) {
        // Target is in front
        thrustInput = 1.0;
    } else {
        // Target is behind, turn around, maybe less thrust
        thrustInput = 0.5;
    }

    // 5. Action / Shooting
    // Randomly shoot if we are moving fast
    let action = false;
    if (time - this.lastActionTime > 0.5) {
        if (Math.random() < 0.05) { // 5% chance per check
            action = true;
            this.lastActionTime = time;
        }
    }

    return {
      vector: { x: turnInput, y: thrustInput }, // y is thrust in Ship.tsx logic for air mode
      action,
      ability: false,
      timestamp: time,
    };
  }
}
