import { Vector3 } from "three";
import { shipPositions, shipRotations } from "../components/Ship";
import { useGameStore } from "../game-store";
import { useCaptureTheFlagStore, TEAM_CONFIG, type TeamId } from "../capture-the-flag-store";
import { useCollectiblesStore, type CollectibleData } from "../collectibles-store";
import { useHealthStore } from "../health-store";
import { OBSTACLES, type ObstacleData, JUMP_PADS, JUMP_PAD_RADIUS, JUMP_FORCE } from "../constants";
import type { JumpPadInfo } from "./ReachabilityChecker";

export interface BotSelf {
  controllerId: string;
  position: Vector3;
  rotation: { x: number; y: number; z: number; w: number };
  health: number;
  teamId: TeamId;
}

export interface PlayerInfo {
  controllerId: string;
  position: Vector3;
  rotation: { x: number; y: number; z: number; w: number };
  health: number;
  teamId: TeamId;
  isEnemy: boolean;
}

export interface FlagInfo {
  teamId: TeamId;
  status: "atBase" | "carried" | "dropped";
  position: [number, number, number];
  carrierId?: string;
}

/**
 * GameContext provides a standardized, read-only view of the game world for bots.
 * This abstraction avoids messy imports and direct store access in bot logic.
 */
export class GameContext {
  /**
   * Get the bot's own state (position, health, team, etc.)
   */
  getSelf(botId: string): BotSelf | null {
    const position = shipPositions.get(botId);
    const rotation = shipRotations.get(botId);
    
    if (!position || !rotation) {
      return null;
    }

    const gameStore = useGameStore.getState();
    const player = gameStore.players.find((p) => p.controllerId === botId);
    if (!player) {
      return null;
    }

    const ctfStore = useCaptureTheFlagStore.getState();
    const teamId = ctfStore.getPlayerTeam(botId) ?? player.teamId;
    const health = useHealthStore.getState().getHealth(botId);

    return {
      controllerId: botId,
      position: position.clone(),
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w,
      },
      health,
      teamId,
    };
  }

  /**
   * Get all obstacles in the game world
   */
  getObstacles(): ObstacleData[] {
    return OBSTACLES;
  }

  /**
   * Get all active collectibles
   */
  getCollectibles(): CollectibleData[] {
    return useCollectiblesStore.getState().collectibles;
  }

  /**
   * Get all players (enemies and allies) with their positions
   */
  getPlayers(botId: string): PlayerInfo[] {
    const gameStore = useGameStore.getState();
    const ctfStore = useCaptureTheFlagStore.getState();
    const healthStore = useHealthStore.getState();
    
    const botTeam = ctfStore.getPlayerTeam(botId);
    if (!botTeam) {
      return [];
    }

    return gameStore.players
      .filter((player) => player.controllerId !== botId) // Exclude self
      .map((player) => {
        const position = shipPositions.get(player.controllerId);
        const rotation = shipRotations.get(player.controllerId);
        const playerTeam = ctfStore.getPlayerTeam(player.controllerId) ?? player.teamId;
        const health = healthStore.getHealth(player.controllerId);

        if (!position || !rotation) {
          return null;
        }

        return {
          controllerId: player.controllerId,
          position: position.clone(),
          rotation: {
            x: rotation.x,
            y: rotation.y,
            z: rotation.z,
            w: rotation.w,
          },
          health,
          teamId: playerTeam,
          isEnemy: playerTeam !== botTeam,
        };
      })
      .filter((p): p is PlayerInfo => p !== null);
  }

  /**
   * Get state of all flags
   */
  getFlags(): FlagInfo[] {
    const ctfStore = useCaptureTheFlagStore.getState();
    return Object.values(ctfStore.flags).map((flag) => ({
      teamId: flag.teamId,
      status: flag.status,
      position: [...flag.position] as [number, number, number],
      carrierId: flag.carrierId,
    }));
  }

  /**
   * Get the base position for a team
   */
  getBasePosition(teamId: TeamId): Vector3 {
    const config = TEAM_CONFIG[teamId];
    return new Vector3(...config.basePosition);
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
    
    const teams = Object.keys(TEAM_CONFIG) as TeamId[];
    return teams.find((team) => team !== self.teamId) ?? null;
  }

  /**
   * Get all jump pads in the game world
   */
  getJumpPads(): JumpPadInfo[] {
    return JUMP_PADS.map((pad) => ({
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
    maxDistance?: number
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

