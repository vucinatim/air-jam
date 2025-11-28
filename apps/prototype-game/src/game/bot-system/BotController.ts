import type { GameLoopInput } from "@air-jam/sdk";
import { Vector3, Quaternion } from "three";
import { GameContext } from "./GameContext";
import { useAbilitiesStore } from "../abilities-store";
import { ARENA_RADIUS, JUMP_PAD_RADIUS } from "../constants";
import { ReachabilityChecker, type JumpPadInfo } from "./ReachabilityChecker";

/**
 * Bot States - The Brain's decision states
 */
export enum BotState {
  SEARCH = "SEARCH", // Wander / Look for targets
  GATHER = "GATHER", // Move to pickup a collectible
  ATTACK = "ATTACK", // Chase and shoot an enemy
  CAPTURE = "CAPTURE", // Move to enemy flag to pick it up
  RETURN = "RETURN", // Carry enemy flag to own base
  DEFEND = "DEFEND", // Chase enemy carrier who has our flag
  RETRIEVE = "RETRIEVE", // Go to dropped own flag to return it
}

/**
 * Bot Brain - High-level decision making (FSM)
 */
class BotBrain {
  private state: BotState = BotState.SEARCH;
  private targetPosition: Vector3 | null = null;
  private targetPlayerId: string | null = null;
  private lastStateChangeTime = 0;
  private stateChangeCooldown = 0.5; // Minimum time between state changes (seconds)
  private lastLogTime = 0;
  private logInterval = 1.0; // Log every 1 second
  
  // Jump pad navigation state
  private usingJumpPad: boolean = false;
  private jumpPadTarget: Vector3 | null = null;
  private originalTarget: Vector3 | null = null; // Target we're trying to reach after jump
  private reachabilityChecker: ReachabilityChecker;
  
  constructor() {
    this.reachabilityChecker = new ReachabilityChecker();
  }

  /**
   * Update the brain's state and target based on priority system
   */
  update(
    botId: string,
    context: GameContext,
    time: number
  ): { state: BotState; target: Vector3 | null; targetPlayerId: string | null } {
    const self = context.getSelf(botId);
    if (!self) {
      return { state: BotState.SEARCH, target: null, targetPlayerId: null };
    }

    // Check if we've completed jump pad usage (we're now in air and moving toward original target)
    if (this.usingJumpPad && this.originalTarget) {
      const isInAir = self.position.y > 5.5;
      const distanceToOriginal = self.position.distanceTo(this.originalTarget);
      
      // If we're in air and close to original target, or if we've passed it vertically, clear jump pad state
      if (isInAir && (distanceToOriginal < 20 || self.position.y >= this.originalTarget.y - 5)) {
        this.usingJumpPad = false;
        this.jumpPadTarget = null;
        this.originalTarget = null;
      }
    }

    // Logging
    if (time - this.lastLogTime > this.logInterval) {
      this.lastLogTime = time;
      console.log(`[BOT ${botId.slice(4)}] State: ${this.state}, Pos: (${self.position.x.toFixed(1)}, ${self.position.y.toFixed(1)}, ${self.position.z.toFixed(1)}), Health: ${self.health.toFixed(0)}`);
      if (this.targetPosition) {
        const dist = self.position.distanceTo(this.targetPosition);
        console.log(`  Target: (${this.targetPosition.x.toFixed(1)}, ${this.targetPosition.y.toFixed(1)}, ${this.targetPosition.z.toFixed(1)}), Distance: ${dist.toFixed(1)}`);
      }
    }

    // Don't change state too frequently
    if (time - this.lastStateChangeTime < this.stateChangeCooldown) {
      return {
        state: this.state,
        target: this.targetPosition,
        targetPlayerId: this.targetPlayerId,
      };
    }

    const flags = context.getFlags();
    const collectibles = context.getCollectibles();
    const enemies = context.getEnemies(botId);
    const enemyTeam = context.getEnemyTeam(botId);

    // Priority 1: Self Preservation - Health < 30% -> Find Health Pack
    if (self.health < 30) {
      const healthPack = collectibles.find((c) => c.abilityId === "health_pack");
      if (healthPack) {
        this.setState(BotState.GATHER, time);
        const healthPackPos = new Vector3(...healthPack.position);
        const target = this.checkReachabilityAndPlanPath(self.position, healthPackPos, context);
        this.targetPosition = target;
        this.targetPlayerId = null;
        if (time - this.lastLogTime > this.logInterval) {
          console.log(`  → GATHER: Health pack at (${healthPackPos.x.toFixed(1)}, ${healthPackPos.y.toFixed(1)}, ${healthPackPos.z.toFixed(1)})`);
          if (this.usingJumpPad) {
            console.log(`    Using jump pad to reach health pack`);
          }
        }
        return {
          state: this.state,
          target: this.targetPosition,
          targetPlayerId: null,
        };
      }
    }

    // Priority 2: Objective - Scoring - Carrying Enemy Flag -> Go to Base
    const enemyFlag = flags.find((f) => f.teamId === enemyTeam);
    if (enemyFlag?.status === "carried" && enemyFlag.carrierId === botId) {
      this.setState(BotState.RETURN, time);
      this.targetPosition = context.getBasePosition(self.teamId);
      this.targetPlayerId = null;
      return {
        state: this.state,
        target: this.targetPosition,
        targetPlayerId: null,
      };
    }

    // Priority 3: Objective - Defense - Enemy has Our Flag -> Chase Enemy Carrier
    const ownFlag = flags.find((f) => f.teamId === self.teamId);
    if (ownFlag?.status === "carried" && ownFlag.carrierId) {
      const carrier = enemies.find((e) => e.controllerId === ownFlag.carrierId);
      if (carrier) {
        this.setState(BotState.DEFEND, time);
        this.targetPosition = carrier.position.clone();
        this.targetPlayerId = carrier.controllerId;
        return {
          state: this.state,
          target: this.targetPosition,
          targetPlayerId: this.targetPlayerId,
        };
      }
    }

    // Priority 4: Objective - Recovery - Our Flag Dropped -> Go to Flag
    if (ownFlag?.status === "dropped") {
      this.setState(BotState.RETRIEVE, time);
      const flagPos = new Vector3(...ownFlag.position);
      const target = this.checkReachabilityAndPlanPath(self.position, flagPos, context);
      this.targetPosition = target;
      this.targetPlayerId = null;
      if (time - this.lastLogTime > this.logInterval && this.usingJumpPad) {
        console.log(`  → RETRIEVE: Using jump pad to reach dropped flag`);
      }
      return {
        state: this.state,
        target: this.targetPosition,
        targetPlayerId: null,
      };
    }

    // Priority 5: Objective - Offense - Enemy Flag at Base -> Go to Enemy Flag
    if (enemyFlag?.status === "atBase") {
      this.setState(BotState.CAPTURE, time);
      const flagPos = new Vector3(...enemyFlag.position);
      const target = this.checkReachabilityAndPlanPath(self.position, flagPos, context);
      this.targetPosition = target;
      this.targetPlayerId = null;
      if (time - this.lastLogTime > this.logInterval && this.usingJumpPad) {
        console.log(`  → CAPTURE: Using jump pad to reach enemy flag`);
      }
      return {
        state: this.state,
        target: this.targetPosition,
        targetPlayerId: null,
      };
    }

    // Priority 6: Combat - Enemy nearby -> ATTACK
    const nearbyEnemy = this.findNearestEnemy(self.position, enemies, 50);
    if (nearbyEnemy) {
      this.setState(BotState.ATTACK, time);
      this.targetPosition = nearbyEnemy.position.clone();
      this.targetPlayerId = nearbyEnemy.controllerId;
      return {
        state: this.state,
        target: this.targetPosition,
        targetPlayerId: this.targetPlayerId,
      };
    }

    // Priority 7: Idle - SEARCH / GATHER random items
    const nearbyCollectible = this.findNearestCollectible(
      self.position,
      collectibles,
      30
    );
    if (nearbyCollectible) {
      this.setState(BotState.GATHER, time);
      const collectiblePos = new Vector3(...nearbyCollectible.position);
      const target = this.checkReachabilityAndPlanPath(self.position, collectiblePos, context);
      this.targetPosition = target;
      this.targetPlayerId = null;
      if (time - this.lastLogTime > this.logInterval && this.usingJumpPad) {
        console.log(`  → GATHER: Using jump pad to reach collectible`);
      }
      return {
        state: this.state,
        target: this.targetPosition,
        targetPlayerId: null,
      };
    }

    // Default: Wander
    if (this.state !== BotState.SEARCH || !this.targetPosition) {
      this.setState(BotState.SEARCH, time);
      this.targetPosition = this.generateWanderTarget(self.position);
      if (time - this.lastLogTime > this.logInterval) {
        console.log(`  → SEARCH: New wander target`);
      }
    }

    // Check if we've reached the target (within 5 units) and need a new one
    if (this.targetPosition && self.position.distanceTo(this.targetPosition) < 5) {
      this.targetPosition = this.generateWanderTarget(self.position);
      if (time - this.lastLogTime > this.logInterval) {
        console.log(`  → Target reached, generating new wander target`);
      }
    }

    return {
      state: this.state,
      target: this.targetPosition,
      targetPlayerId: this.targetPlayerId,
    };
  }

  private setState(newState: BotState, time: number) {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChangeTime = time;
    }
  }

  /**
   * Force generation of a new target (used when stuck)
   */
  public forceNewTarget(currentPos: Vector3) {
    this.targetPosition = this.generateWanderTarget(currentPos);
    this.lastStateChangeTime = 0; // Allow immediate state change
    this.state = BotState.SEARCH; // Reset to search state
  }

  private findNearestEnemy(
    position: Vector3,
    enemies: ReturnType<GameContext["getEnemies"]>,
    maxDistance: number
  ) {
    let nearest: ReturnType<GameContext["getEnemies"]>[0] | null = null;
    let nearestDist = maxDistance;

    for (const enemy of enemies) {
      const dist = position.distanceTo(enemy.position);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private findNearestCollectible(
    position: Vector3,
    collectibles: ReturnType<GameContext["getCollectibles"]>,
    maxDistance: number
  ) {
    let nearest: ReturnType<GameContext["getCollectibles"]>[0] | null = null;
    let nearestDist = maxDistance;

    for (const collectible of collectibles) {
      const dist = position.distanceTo(new Vector3(...collectible.position));
      if (dist < nearestDist) {
        nearest = collectible;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private generateWanderTarget(currentPos: Vector3): Vector3 {
    // Generate a random point within arena bounds
    // If bot is in the air, keep target at similar height
    const isInAir = currentPos.y > 5.5; // HOVER_HEIGHT + AIR_MODE_THRESHOLD
    const targetY = isInAir 
      ? Math.max(5, Math.min(30, currentPos.y + (Math.random() - 0.5) * 10)) // Stay near current height when in air
      : 10 + Math.random() * 20; // Normal height when on ground

    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * (ARENA_RADIUS * 0.6);
    const x = currentPos.x + Math.cos(angle) * distance;
    const z = currentPos.z + Math.sin(angle) * distance;

    // Clamp to arena bounds
    const clampedX = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, x));
    const clampedZ = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, z));

    return new Vector3(clampedX, targetY, clampedZ);
  }

  /**
   * Check if target is reachable and plan path (including jump pad if needed)
   */
  private checkReachabilityAndPlanPath(
    from: Vector3,
    to: Vector3,
    context: GameContext
  ): Vector3 {
    // If already using a jump pad, continue to jump pad target
    if (this.usingJumpPad && this.jumpPadTarget) {
      // Check if we've reached the jump pad (within radius)
      const distanceToJumpPad = from.distanceTo(this.jumpPadTarget);
      if (distanceToJumpPad < 6) {
        // We're on the jump pad, return jump pad position to maintain alignment
        return this.jumpPadTarget;
      }
      // Still approaching jump pad
      return this.jumpPadTarget;
    }

    // Check if target is reachable
    if (this.reachabilityChecker.isReachable(from, to)) {
      // Target is reachable, clear any jump pad state
      this.usingJumpPad = false;
      this.jumpPadTarget = null;
      this.originalTarget = null;
      return to;
    }

    // Target is not reachable, find a jump pad
    const jumpPad = this.reachabilityChecker.findJumpPadForTarget(
      from,
      to,
      context
    );

    if (jumpPad) {
      // Set up jump pad navigation
      this.usingJumpPad = true;
      this.jumpPadTarget = jumpPad.position.clone();
      this.originalTarget = to.clone();
      return this.jumpPadTarget;
    }

    // No jump pad available, try to get as close as possible
    this.usingJumpPad = false;
    this.jumpPadTarget = null;
    this.originalTarget = null;
    return to;
  }
}

/**
 * Bot Body - Low-level movement (Steering Behaviors)
 */
class BotBody {
  private readonly AVOID_WEIGHT = 1.5; // Reduced from 2.0 to prevent over-correction
  private readonly SEPARATION_WEIGHT = 1.0; // Reduced from 1.5
  private readonly AVOID_RADIUS = 15.0;
  private readonly SEPARATION_RADIUS = 10.0;
  private readonly SHOOT_ANGLE_THRESHOLD = 0.3; // Radians (~17 degrees) - more lenient
  private readonly SHOOT_MAX_DISTANCE = 100.0; // Maximum distance to shoot at enemies
  private logFrameCount = 0;
  private logInterval = 60; // Log every 60 frames (~1 second at 60fps)

  /**
   * Calculate steering forces and return input vector
   */
  calculateSteering(
    botId: string,
    context: GameContext,
    target: Vector3 | null,
    state: BotState
  ): { vector: { x: number; y: number }; shouldShoot: boolean } {
    const self = context.getSelf(botId);
    if (!self || !target) {
      return { vector: { x: 0, y: 0 }, shouldShoot: false };
    }

    const position = self.position;
    const rotation = new Quaternion(
      self.rotation.x,
      self.rotation.y,
      self.rotation.z,
      self.rotation.w
    );

    const isInAir = position.y > 5.5; // HOVER_HEIGHT + AIR_MODE_THRESHOLD

    // Check if target is a jump pad
    const jumpPadInfo = this.findJumpPadAtTarget(target, context);
    const isJumpPadTarget = jumpPadInfo !== null;

    // Adjust target height if bot is in the air - don't force it to dive down
    const adjustedTarget = target.clone();
    if (isInAir && adjustedTarget.y < position.y - 5 && !isJumpPadTarget) {
      // If target is much lower and we're in air, aim for similar height
      // But don't adjust if it's a jump pad (we want to land on it)
      adjustedTarget.y = Math.max(position.y - 5, adjustedTarget.y);
    }

    // If approaching jump pad, use special alignment steering
    let seekForce: Vector3;
    if (isJumpPadTarget && jumpPadInfo) {
      seekForce = this.calculateJumpPadAlignment(position, jumpPadInfo.position, jumpPadInfo.radius);
    } else {
      // Force 1: Seek - Vector towards target
      seekForce = this.calculateSeek(position, adjustedTarget);
    }

    // Force 2: Avoid - Raycast/Sphere check against obstacles (only check obstacles at similar height)
    const avoidForce = this.calculateAvoid(position, rotation, context, isInAir);

    // Force 3: Separation - Avoid crashing into other ships
    const separationForce = this.calculateSeparation(
      position,
      context.getPlayers(botId)
    );

    // Combine forces
    const finalForce = seekForce
      .add(avoidForce.multiplyScalar(this.AVOID_WEIGHT))
      .add(separationForce.multiplyScalar(this.SEPARATION_WEIGHT));

    // Normalize and convert to input
    const inputVector = this.forceToInput(finalForce, position, rotation, adjustedTarget);

    // Logging
    this.logFrameCount++;
    if (this.logFrameCount >= this.logInterval) {
      this.logFrameCount = 0;
      const toTarget = adjustedTarget.clone().sub(position);
      const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
      const angle = toTarget.normalize().dot(forward);
      console.log(`  Body: Input (${inputVector.x.toFixed(2)}, ${inputVector.y.toFixed(2)}), InAir: ${isInAir}, AngleToTarget: ${(Math.acos(angle) * 180 / Math.PI).toFixed(1)}°`);
      console.log(`    Forces: Seek(${seekForce.length().toFixed(2)}), Avoid(${avoidForce.length().toFixed(2)}), Sep(${separationForce.length().toFixed(2)})`);
    }

    // Determine if we should shoot - check for any enemy in line of sight
    const shouldShoot = this.shouldShootAtEnemy(
      position,
      rotation,
      context,
      botId,
      state
    );

    return {
      vector: inputVector,
      shouldShoot,
    };
  }

  /**
   * Check if we should shoot at any enemy in line of sight
   */
  private shouldShootAtEnemy(
    position: Vector3,
    rotation: Quaternion,
    context: GameContext,
    botId: string,
    state: BotState
  ): boolean {
    const enemies = context.getEnemies(botId);
    const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);

    // Check all enemies to see if any are in line of sight
    for (const enemy of enemies) {
      const toEnemy = enemy.position.clone().sub(position);
      const distance = toEnemy.length();

      // Only shoot at enemies within range
      if (distance > this.SHOOT_MAX_DISTANCE) {
        continue;
      }

      // Check if enemy is in front of us (within angle threshold)
      const toEnemyNormalized = toEnemy.normalize();
      const angle = toEnemyNormalized.dot(forward);

      // angle > 0.7 means within ~45 degrees, but we use SHOOT_ANGLE_THRESHOLD
      if (angle > 1.0 - this.SHOOT_ANGLE_THRESHOLD) {
        // Enemy is in sights! Check if there's an obstacle blocking
        const isBlocked = this.isLineOfSightBlocked(
          position,
          enemy.position,
          context
        );

        if (!isBlocked) {
          // Log when we start shooting
          if (this.logFrameCount === 0) {
            console.log(`  → SHOOTING at enemy ${enemy.controllerId.slice(4)} (dist: ${distance.toFixed(1)}, angle: ${(Math.acos(angle) * 180 / Math.PI).toFixed(1)}°)`);
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if line of sight to target is blocked by obstacles
   */
  private isLineOfSightBlocked(
    from: Vector3,
    to: Vector3,
    context: GameContext
  ): boolean {
    const obstacles = context.getObstacles();
    const direction = to.clone().sub(from);
    const distance = direction.length();
    const directionNormalized = direction.normalize();

    // Simple sphere check - if obstacle is close to the line, consider it blocked
    for (const obstacle of obstacles) {
      const obstaclePos = new Vector3(...obstacle.position);
      const toObstacle = obstaclePos.clone().sub(from);
      
      // Project obstacle position onto the line
      const projectionLength = toObstacle.dot(directionNormalized);
      
      // If projection is within the line segment
      if (projectionLength > 0 && projectionLength < distance) {
        const closestPoint = from.clone().add(
          directionNormalized.clone().multiplyScalar(projectionLength)
        );
        const distToLine = closestPoint.distanceTo(obstaclePos);
        const obstacleRadius = Math.max(...obstacle.size) / 2;
        
        // If obstacle is close to the line, it's blocking
        if (distToLine < obstacleRadius + 2) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateSeek(position: Vector3, target: Vector3): Vector3 {
    const toTarget = target.clone().sub(position);
    const distance = toTarget.length();
    if (distance < 0.1) {
      return new Vector3(0, 0, 0);
    }
    return toTarget.normalize();
  }

  private calculateAvoid(
    position: Vector3,
    rotation: Quaternion,
    context: GameContext,
    isInAir: boolean
  ): Vector3 {
    const obstacles = context.getObstacles();
    const avoidForce = new Vector3(0, 0, 0);

    for (const obstacle of obstacles) {
      const obstaclePos = new Vector3(...obstacle.position);
      const obstacleHeight = obstacle.size[1] / 2; // Half height
      const obstacleTop = obstaclePos.y + obstacleHeight;
      const obstacleBottom = obstaclePos.y - obstacleHeight;

      // If in air and obstacle is below us, ignore it (we can fly over)
      if (isInAir && obstacleTop < position.y - 2) {
        continue;
      }

      // Calculate horizontal distance (ignore Y for horizontal avoidance)
      const horizontalDist = Math.sqrt(
        Math.pow(position.x - obstaclePos.x, 2) +
        Math.pow(position.z - obstaclePos.z, 2)
      );

      // Check if we're at a similar height level
      const heightDiff = Math.abs(position.y - obstaclePos.y);
      const isAtSimilarHeight = heightDiff < obstacleHeight + 5;

      if (horizontalDist < this.AVOID_RADIUS && isAtSimilarHeight) {
        // Calculate avoidance force (push away horizontally)
        const away = new Vector3(
          position.x - obstaclePos.x,
          0, // Don't push up/down, just horizontally
          position.z - obstaclePos.z
        );
        const distance = away.length();
        if (distance > 0) {
          const strength = 1.0 - horizontalDist / this.AVOID_RADIUS;
          avoidForce.add(away.normalize().multiplyScalar(strength));
        }
      }
    }

    return avoidForce;
  }

  private calculateSeparation(
    position: Vector3,
    players: ReturnType<GameContext["getPlayers"]>
  ): Vector3 {
    const separationForce = new Vector3(0, 0, 0);

    for (const player of players) {
      const dist = position.distanceTo(player.position);
      if (dist < this.SEPARATION_RADIUS && dist > 0) {
        const away = position.clone().sub(player.position);
        const strength = 1.0 - dist / this.SEPARATION_RADIUS;
        separationForce.add(away.normalize().multiplyScalar(strength));
      }
    }

    return separationForce;
  }

  private forceToInput(
    force: Vector3,
    position: Vector3,
    rotation: Quaternion,
    target: Vector3
  ): { x: number; y: number } {
    if (force.length() < 0.01) {
      return { x: 0, y: 0 };
    }

    // Transform force to local space
    const localForce = force.clone().applyQuaternion(rotation.clone().invert());

    // x > 0 means force is to the right, x < 0 means left
    // z < 0 means force is forward, z > 0 means backward
    
    // Calculate turn input with smoothing to prevent oscillation
    const turnInput = Math.max(-1, Math.min(1, localForce.x * 3)); // Reduced multiplier from 5 to 3 for smoother turning
    
    // Thrust logic:
    // - If in air, ship automatically uses full thrust, so we just need to control direction
    // - If force is forward (negative Z), use full thrust
    // - If force is backward, on ground: stop moving forward to allow turning in place
    const isInAir = position.y > 5.5;
    let thrustInput = 0;
    
    if (isInAir) {
      // In air mode, ship uses full thrust automatically
      // We still want to provide some input to maintain control
      thrustInput = localForce.z < 0 ? 1.0 : 0.3; // Less thrust when turning around
    } else {
      // On ground, normal thrust control
      if (localForce.z < 0) {
        // Force is forward, use full thrust
        thrustInput = 1.0;
      } else {
        // Force is backward (target is behind us)
        // Stop moving forward to allow turning in place when we need to turn
        const needsSignificantTurn = Math.abs(turnInput) > 0.3;
        if (needsSignificantTurn) {
          // Stop moving forward so we can turn in place
          thrustInput = 0;
        } else {
          // Small adjustment, can move forward slightly
          thrustInput = 0.5;
        }
      }
    }

    // Prevent extreme turning that could cause loops
    // If we're turning too hard, reduce it slightly
    if (Math.abs(turnInput) > 0.9) {
      return { x: turnInput * 0.8, y: thrustInput };
    }

    return { x: turnInput, y: thrustInput };
  }

  private isTargetInSights(
    position: Vector3,
    rotation: Quaternion,
    target: Vector3,
    context: GameContext,
    botId: string
  ): boolean {
    const toTarget = target.clone().sub(position);
    const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
    
    const angle = toTarget.normalize().dot(forward);
    return angle > 1.0 - this.SHOOT_ANGLE_THRESHOLD;
  }

  /**
   * Check if target position is near a jump pad
   */
  private findJumpPadAtTarget(
    target: Vector3,
    context: GameContext
  ): JumpPadInfo | null {
    const jumpPads = context.getJumpPads();
    const JUMP_PAD_DETECTION_RADIUS = JUMP_PAD_RADIUS * 1.5; // Slightly larger than actual radius

    for (const pad of jumpPads) {
      const distance = target.distanceTo(pad.position);
      if (distance < JUMP_PAD_DETECTION_RADIUS) {
        return pad;
      }
    }

    return null;
  }

  /**
   * Calculate steering force for jump pad alignment
   * Provides precision landing behavior when approaching jump pads
   */
  private calculateJumpPadAlignment(
    position: Vector3,
    jumpPadPos: Vector3,
    jumpPadRadius: number
  ): Vector3 {
    const toJumpPad = jumpPadPos.clone().sub(position);
    const distance = toJumpPad.length();
    const horizontalDistance = Math.sqrt(
      Math.pow(position.x - jumpPadPos.x, 2) +
      Math.pow(position.z - jumpPadPos.z, 2)
    );

    // Strong centering force when close to jump pad
    if (distance < jumpPadRadius * 1.5) {
      // Calculate horizontal centering force
      const horizontalForce = new Vector3(
        jumpPadPos.x - position.x,
        0,
        jumpPadPos.z - position.z
      ).normalize();

      // Vertical alignment - aim for hover height (~5m) when approaching
      const targetHeight = 5; // HOVER_HEIGHT
      const heightDiff = targetHeight - position.y;
      const verticalForce = new Vector3(0, Math.sign(heightDiff) * Math.min(Math.abs(heightDiff) / 2, 1), 0);

      // Combine forces with stronger weight when very close
      const proximityFactor = 1.0 - (horizontalDistance / (jumpPadRadius * 1.5));
      const centeringWeight = 2.0 + proximityFactor * 3.0; // Stronger when closer

      return horizontalForce.multiplyScalar(centeringWeight).add(verticalForce);
    }

    // Normal seek when far away
    return toJumpPad.normalize();
  }
}

/**
 * Bot Controller - Main class combining Brain and Body
 */
export class BotController {
  private controllerId: string;
  private brain: BotBrain;
  private body: BotBody;
  private context: GameContext;
  private lastAbilityCheckTime = 0;
  private lastInputHistory: Array<{ x: number; time: number }> = [];
  private stuckTurnDetectionTime = 0;

  constructor(controllerId: string) {
    this.controllerId = controllerId;
    this.brain = new BotBrain();
    this.body = new BotBody();
    this.context = new GameContext();
  }

  update(delta: number, time: number): GameLoopInput {
    // Update brain (decision making)
    const { state, target, targetPlayerId } = this.brain.update(
      this.controllerId,
      this.context,
      time
    );

    // Update body (movement)
    let { vector, shouldShoot } = this.body.calculateSteering(
      this.controllerId,
      this.context,
      target,
      state
    );

    // Detect if bot is stuck in a turning loop
    this.lastInputHistory.push({ x: vector.x, time });
    // Keep only last 2 seconds of history
    this.lastInputHistory = this.lastInputHistory.filter(
      (entry) => time - entry.time < 2.0
    );

    // Check if we've been turning in the same direction for too long
    if (this.lastInputHistory.length > 30) {
      // Check if all recent inputs are turning in same direction
      const allSameDirection = this.lastInputHistory.every(
        (entry) => Math.sign(entry.x) === Math.sign(vector.x) && Math.abs(entry.x) > 0.3
      );

      if (allSameDirection && Math.abs(vector.x) > 0.5) {
        // We're stuck turning! Reset target
        if (time - this.stuckTurnDetectionTime > 1.0) {
          console.log(`[BOT ${this.controllerId.slice(4)}] Detected stuck turning loop! Resetting target.`);
          this.stuckTurnDetectionTime = time;
          // Force brain to generate new target
          const self = this.context.getSelf(this.controllerId);
          if (self) {
            this.brain.forceNewTarget(self.position);
          }
          // Reduce turn input to break the loop
          vector.x *= 0.3;
        }
      } else {
        this.stuckTurnDetectionTime = 0;
      }
    }

    // Ability logic
    const ability = this.shouldUseAbility(state, time);

    // Shooting logic - hold down button when enemy is in sights
    // The ship component handles the shooting interval automatically
    // We just need to keep action: true when shouldShoot is true
    const action = shouldShoot;

    return {
      vector,
      action,
      ability,
      timestamp: time,
    };
  }

  private shouldUseAbility(state: BotState, time: number): boolean {
    const abilitiesStore = useAbilitiesStore.getState();
    const queuedAbility = abilitiesStore.getQueuedAbility(this.controllerId);
    
    if (!queuedAbility) {
      return false;
    }

    // Don't check abilities too frequently
    if (time - this.lastAbilityCheckTime < 0.1) {
      return false;
    }
    this.lastAbilityCheckTime = time;

    const self = this.context.getSelf(this.controllerId);
    if (!self) {
      return false;
    }

    // Health Pack: Use immediately if Health < 100
    if (queuedAbility.id === "health_pack" && self.health < 100) {
      return true;
    }

    // Speed Boost: Use if RETURNing flag or DEFENDing (chasing carrier)
    if (
      queuedAbility.id === "speed_boost" &&
      (state === BotState.RETURN || state === BotState.DEFEND)
    ) {
      return true;
    }

    // Rocket: Use if ATTACKing (the body will check if target is in sights)
    if (queuedAbility.id === "rocket" && state === BotState.ATTACK) {
      return true;
    }

    return false;
  }
}
