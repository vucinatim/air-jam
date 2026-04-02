/**
 * Player capability mapping based on PM requirements.
 *
 * Capability to seconds mapping:
 * - 5: 4 seconds (fastest)
 * - 4: 7 seconds
 * - 3: 10 seconds (default/average)
 * - 2: 13 seconds
 * - 1: 17 seconds (slowest)
 */

import type { TaskId } from "./task-manager";

export interface Player {
  id: string;
  name: string;
  image: string;
  /** Map of task ID to capability level (1-5, where 3 is average 10s) */
  capabilities: Partial<Record<TaskId, number>>;
}

/** Helper to create a player with specific strengths/weaknesses, defaulting others to 3 (average) */
function createPlayer(
  id: string,
  name: string,
  image: string,
  specialCapabilities: Partial<Record<TaskId, number>>,
): Player {
  const capabilities: Partial<Record<TaskId, number>> = {};

  // Apply special capabilities (strengths and weaknesses)
  Object.entries(specialCapabilities).forEach(([task, level]) => {
    capabilities[task as TaskId] = level;
  });

  return { id, name, image, capabilities };
}

export const PLAYERS: Player[] = [
  // Špela: emails and meetings fastest (5), coding slowest (1-2), rest average (3)
  createPlayer("spela", "Špela", "/team/spela.webp", {
    maili: 5,
    "sestanek-v-sejni": 5,
    "interni-sestanek": 5,
    coding: 1,
    "vibe-coding": 2,
  }),

  // Žiga: maili and sestanek-v-sejni fast, opravek slow
  createPlayer("ziga", "Žiga", "/team/ziga.webp", {
    maili: 5,
    "sestanek-v-sejni": 4,
    opravek: 1,
    "interni-sestanek": 2,
  }),

  // Miha: sestanek-v-sejni and opravek fast, coding slower
  createPlayer("miha", "Miha", "/team/miha.webp", {
    "sestanek-v-sejni": 5,
    opravek: 1,
    coding: 2,
    "narisi-strip": 4,
  }),

  // Matej: coding and internet-down fast, sestanek-v-sejni slow
  createPlayer("matej", "Matej", "/team/matej.webp", {
    coding: 5,
    "internet-down": 4,
    "sestanek-v-sejni": 1,
    opravek: 2,
  }),

  // Niki: narisi-strip and internet-down fast
  createPlayer("niki", "Niki", "/team/niki.webp", {
    "narisi-strip": 5,
    "internet-down": 1,
    "vibe-coding": 2,
    opravek: 4,
  }),

  // Vane: hisninska-dela and internet-down fast
  createPlayer("vane", "Vane", "/team/vane.webp", {
    "hisninska-dela": 1,
    "internet-down": 5,
    "interni-sestanek": 2,
    "vibe-coding": 4,
  }),

  // Domen: hisninska-dela and sestanek-v-sejni fast
  createPlayer("domen", "Domen", "/team/domen.webp", {
    "hisninska-dela": 5,
    "sestanek-v-sejni": 1,
    maili: 2,
    "vibe-coding": 4,
  }),

  // TimK: coding and narisi-strip fast
  createPlayer("timk", "TimK", "/team/timk.webp", {
    coding: 5,
    "narisi-strip": 1,
    "vibe-coding": 2,
    opravek: 4,
  }),

  // TimV: vibe-coding and opravek fast
  createPlayer("timv", "TimV", "/team/timv.webp", {
    "vibe-coding": 5,
    opravek: 1,
    maili: 2,
    "narisi-strip": 4,
  }),
];

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function getRandomUnassignedPlayer(
  assignedIds: string[],
): Player | undefined {
  const available = PLAYERS.filter((p) => !assignedIds.includes(p.id));
  if (available.length === 0) return undefined;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Get the duration in milliseconds for a player to complete a task.
 * Based on capability level:
 * - 5: 4 seconds
 * - 4: 7 seconds
 * - 3: 10 seconds (default/average)
 * - 2: 13 seconds
 * - 1: 17 seconds
 */
export function getTaskDurationMs(taskId: string, playerId: string): number {
  const player = getPlayerById(playerId);
  if (!player) return 10000; // Default 10 seconds

  const capability = player.capabilities[taskId as TaskId];

  // Capability to seconds mapping
  const capabilityToSeconds: Record<number, number> = {
    5: 4000, // 4 seconds
    4: 7000, // 7 seconds
    3: 10000, // 10 seconds (average)
    2: 13000, // 13 seconds
    1: 17000, // 17 seconds
  };

  // If no capability specified, use default 10 seconds
  if (capability === undefined) {
    return 10000;
  }

  return capabilityToSeconds[capability] ?? 10000;
}

/**
 * Check if a player can perform a specific task.
 * All players can now perform all tasks - this always returns true.
 * The difference is in how fast they complete them.
 */
export function canPlayerDoTask(taskId: string, playerId: string): boolean {
  const player = getPlayerById(playerId);
  if (!player) return false;
  // All players can do all tasks now - capabilities only affect speed
  return player.capabilities[taskId as TaskId] !== undefined;
}
