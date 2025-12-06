import { Vector3 } from "three";
import { GameContext } from "./GameContext";

export interface JumpPadInfo {
  id: string;
  position: Vector3;
  radius: number;
  jumpForce: number;
}

/**
 * ReachabilityChecker determines if a target is reachable and how to reach it.
 * Handles vertical reachability checks and jump pad selection.
 */
export class ReachabilityChecker {
  private readonly REACHABILITY_THRESHOLD = 8; // meters above current position
  private readonly MAX_GRAVITY = 15; // Worst-case gravity (m/s²)
  private readonly SAFETY_MARGIN = 5; // Extra height margin for safety (meters)

  /**
   * Check if target is reachable from current position
   */
  isReachable(from: Vector3, to: Vector3): boolean {
    const heightDiff = to.y - from.y;

    // If target is below or at similar height, it's reachable
    if (heightDiff <= this.REACHABILITY_THRESHOLD) {
      return true;
    }

    // If bot is already in air and above target, it's reachable
    if (from.y > 5.5 && from.y >= to.y) {
      return true;
    }

    // Otherwise, need to check if jump pad can help
    return false;
  }

  /**
   * Find jump pad that can help reach target
   */
  findJumpPadForTarget(
    from: Vector3,
    to: Vector3,
    context: GameContext,
  ): JumpPadInfo | null {
    const jumpPads = context.getJumpPads();

    if (jumpPads.length === 0) {
      return null;
    }

    // Filter jump pads that can reach target height
    const viablePads = jumpPads.filter((pad) =>
      this.canJumpPadReachHeight(pad.position, to.y, pad.jumpForce),
    );

    if (viablePads.length === 0) {
      return null;
    }

    // Score each jump pad and return the best one
    return this.findBestJumpPad(from, to, viablePads);
  }

  /**
   * Calculate if jump pad can launch to target height
   */
  canJumpPadReachHeight(
    jumpPadPos: Vector3,
    targetHeight: number,
    jumpForce: number,
  ): boolean {
    const maxHeight = this.estimateJumpHeight(jumpForce, jumpPadPos.y);
    // Add safety margin to ensure we can actually reach the target
    return maxHeight >= targetHeight + this.SAFETY_MARGIN;
  }

  /**
   * Estimate maximum height from jump pad launch
   * Uses physics: h = v₀² / (2g) where v₀ is initial velocity, g is gravity
   */
  estimateJumpHeight(jumpForce: number, initialHeight: number): number {
    // Use worst-case gravity for conservative estimate
    const maxHeightGain = (jumpForce * jumpForce) / (2 * this.MAX_GRAVITY);
    return initialHeight + maxHeightGain;
  }

  /**
   * Find the best jump pad based on distance from bot and target
   */
  private findBestJumpPad(
    botPos: Vector3,
    targetPos: Vector3,
    viablePads: JumpPadInfo[],
  ): JumpPadInfo {
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

  /**
   * Get reachability threshold
   */
  getReachabilityThreshold(): number {
    return this.REACHABILITY_THRESHOLD;
  }
}
