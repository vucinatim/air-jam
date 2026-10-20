import { Vector3 } from "three";
import { JUMP_FORCE, JUMP_PAD_RADIUS } from "../constants";
import { TEAM_IDS, type TeamId } from "../domain/team";
import {
  AIR_CAPTURE_ARENA_JUMP_PADS,
  AIR_CAPTURE_ARENA_OBSTACLES,
  type ObstacleData,
} from "../prefabs/arena/layout";
import type {
  BotWorld,
  CollectibleInfo,
  FlagInfo,
  ShipInfo,
} from "./bot-world";
import type { JumpPadInfo } from "./reachability-checker";

export type { FlagInfo };

export interface BotSelf {
  controllerId: string;
  position: Vector3;
  rotation: { x: number; y: number; z: number; w: number };
  health: number;
  teamId: TeamId;
  queuedAbility: string | null;
}

export interface PlayerInfo {
  controllerId: string;
  position: Vector3;
  rotation: { x: number; y: number; z: number; w: number };
  health: number;
  teamId: TeamId;
  isEnemy: boolean;
}

/**
 * A read-only view of one arena snapshot for bot logic, in the vector types
 * the pilot works with. It reads nothing live, so the same logic runs on the
 * host and in test players.
 */
export class GameContext {
  constructor(private readonly world: BotWorld) {}

  private ship(controllerId: string): ShipInfo | undefined {
    return this.world.ships.find((ship) => ship.controllerId === controllerId);
  }

  /**
   * Get the bot's own state (position, health, team, etc.)
   */
  getSelf(botId: string): BotSelf | null {
    const ship = this.ship(botId);
    if (!ship) return null;
    return {
      controllerId: botId,
      position: new Vector3(...ship.position),
      rotation: { ...ship.rotation },
      health: ship.health,
      teamId: ship.teamId,
      queuedAbility: ship.queuedAbility,
    };
  }

  /**
   * Get all obstacles in the game world
   */
  getObstacles(): ObstacleData[] {
    return AIR_CAPTURE_ARENA_OBSTACLES;
  }

  /**
   * Get all active collectibles
   */
  getCollectibles(): CollectibleInfo[] {
    return this.world.collectibles;
  }

  /**
   * Get all players (enemies and allies) with their positions
   */
  getPlayers(botId: string): PlayerInfo[] {
    const botTeam = this.ship(botId)?.teamId;
    if (!botTeam) return [];
    return this.world.ships
      .filter((ship) => ship.controllerId !== botId)
      .map((ship) => ({
        controllerId: ship.controllerId,
        position: new Vector3(...ship.position),
        rotation: { ...ship.rotation },
        health: ship.health,
        teamId: ship.teamId,
        isEnemy: ship.teamId !== botTeam,
      }));
  }

  /**
   * Get state of all flags
   */
  getFlags(): FlagInfo[] {
    return this.world.flags.map((flag) => ({
      ...flag,
      position: [...flag.position],
    }));
  }

  /**
   * Get the base position for a team
   */
  getBasePosition(teamId: TeamId): Vector3 {
    return new Vector3(...this.world.basePositions[teamId]);
  }

  /**
   * Get enemies only
   */
  getEnemies(botId: string): PlayerInfo[] {
    return this.getPlayers(botId).filter((p) => p.isEnemy);
  }

  /**
   * Get allies only
   */
  getAllies(botId: string): PlayerInfo[] {
    return this.getPlayers(botId).filter((p) => !p.isEnemy);
  }

  /**
   * Get the enemy team ID
   */
  getEnemyTeam(botId: string): TeamId | null {
    const self = this.getSelf(botId);
    if (!self) return null;

    const teams = TEAM_IDS;
    return teams.find((team) => team !== self.teamId) ?? null;
  }

  /**
   * Get all jump pads in the game world
   */
  getJumpPads(): JumpPadInfo[] {
    return AIR_CAPTURE_ARENA_JUMP_PADS.map((pad) => ({
      id: pad.id,
      position: new Vector3(...pad.position),
      radius: JUMP_PAD_RADIUS,
      jumpForce: JUMP_FORCE,
    }));
  }

  /**
   * Find the nearest jump pad to a position
   */
  findNearestJumpPad(
    position: Vector3,
    maxDistance?: number,
  ): JumpPadInfo | null {
    const jumpPads = this.getJumpPads();
    let nearest: JumpPadInfo | null = null;
    let nearestDist = maxDistance ?? Infinity;

    for (const pad of jumpPads) {
      const dist = position.distanceTo(pad.position);
      if (dist < nearestDist) {
        nearest = pad;
        nearestDist = dist;
      }
    }

    return nearest;
  }
}
