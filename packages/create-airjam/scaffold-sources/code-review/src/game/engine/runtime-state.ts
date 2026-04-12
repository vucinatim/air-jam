import {
  IDLE_FRAME_MAX_MS,
  IDLE_FRAME_MIN_MS,
  MAX_HP,
  SPAWN_X_PLAYER1_BACK,
  SPAWN_X_PLAYER1_FRONT,
  SPAWN_X_PLAYER2_BACK,
  SPAWN_X_PLAYER2_FRONT,
  SPAWN_Y,
} from "./constants";
import type { HpState, KoState, PlayerState, RuntimePlayerState } from "./types";

const getNextIdleSwap = (now: number) =>
  now + IDLE_FRAME_MIN_MS + Math.random() * (IDLE_FRAME_MAX_MS - IDLE_FRAME_MIN_MS);

export const makePlayerState = (
  x: number,
  y: number,
  now: number = performance.now(),
): PlayerState => ({
  x,
  y,
  vx: 0,
  vy: 0,
  punchingLeft: false,
  punchingRight: false,
  cooldownLeft: 0,
  cooldownRight: 0,
  punchEndLeft: 0,
  punchEndRight: 0,
  punchLandedLeft: false,
  punchLandedRight: false,
  knockbackFrames: 0,
  defending: false,
  hitFlashEnd: 0,
  idleLeft: Math.random() > 0.5,
  idleNextSwap: getNextIdleSwap(now),
  empoweredUntil: 0,
  punchEmpowered: false,
});

export const createRuntimePlayerState = (
  now: number = performance.now(),
): RuntimePlayerState => ({
  player1Front: makePlayerState(SPAWN_X_PLAYER1_FRONT, SPAWN_Y, now),
  player1Back: makePlayerState(SPAWN_X_PLAYER1_BACK, SPAWN_Y, now),
  player2Front: makePlayerState(SPAWN_X_PLAYER2_FRONT, SPAWN_Y, now),
  player2Back: makePlayerState(SPAWN_X_PLAYER2_BACK, SPAWN_Y, now),
});

export const createHpState = (): HpState => ({ team1: MAX_HP, team2: MAX_HP });

export const createKoState = (): KoState => ({
  active: false,
  winner: null,
  endTime: 0,
});
