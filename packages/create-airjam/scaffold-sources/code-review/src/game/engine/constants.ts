import type { Position, Team } from "../domain/team-assignments";
import type { ArenaColors, PlayerKey } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const FIELD_WIDTH = 720;
export const FIELD_HEIGHT = 720;
export const SPRITE_SCALE = 1.25;
export const PLAYER_DRAW_SIZE = Math.round(120 * SPRITE_SCALE);
export const PLAYER_SIZE = 30;
export const PLAYER_SPAWN_OFFSET = 120;
export const ACCELERATION = 0.55;
export const MOVE_FRICTION = 0.84;
export const COAST_FRICTION = 0.68;
export const KNOCKBACK_FRICTION = 0.9;
export const MAX_VELOCITY = 6.5;
export const VELOCITY_EPSILON = 0.05;
export const RING_PADDING = 42;
export const ROPE_GAP = 14;
export const COLLISION_PUSH = 3;
export const HITBOX_CENTER = PLAYER_SIZE / 2;
export const PLAYER_INSET_X = PLAYER_DRAW_SIZE * 0.25 - HITBOX_CENTER;
export const PUNCH_DISPLACEMENT = 20;
export const PUNCH_KNOCKBACK_VELOCITY = 12;
export const PUNCH_KNOCKBACK_FRAMES = 6;
export const PUNCH_RECOIL = 3;
export const PUNCH_HITBOX_EXTENSION = 30;
export const MAX_HP = 100;
export const PUNCH_DAMAGE = 8;
export const DEFEND_DAMAGE_MULTIPLIER = 0.5;
export const DEFEND_KNOCKBACK_MULTIPLIER = 0.5;
export const DEFEND_ACCELERATION_MULTIPLIER = 0.5;
export const HIT_FLASH_MS = 150;
export const EMPOWER_DURATION_MS = 2_000;
export const EMPOWER_DAMAGE_MULTIPLIER = 1.5;
export const EMPOWER_KNOCKBACK_MULTIPLIER = 1.5;
export const HIT_FLASH_TINT_ALPHA = 0.32;
export const EMPOWER_GLOW_COLOR = "#fbbf24";
export const KO_COUNTDOWN_MS = 3_000;

export const HOST_STATUS_COPY: Record<string, string> = {
  idle: "Idle",
  connecting: "Waiting for server…",
  connected: "Ready for controllers",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting…",
};

export const RING_MIN_X = RING_PADDING + PLAYER_INSET_X;
export const RING_MAX_X =
  FIELD_WIDTH - RING_PADDING - PLAYER_SIZE - PLAYER_INSET_X;
export const RING_MIN_Y = RING_PADDING + PLAYER_INSET_X;
export const RING_MAX_Y =
  FIELD_HEIGHT - RING_PADDING - PLAYER_SIZE - PLAYER_INSET_X;
export const SPAWN_Y = FIELD_HEIGHT / 2 - HITBOX_CENTER;
export const SPAWN_X_PLAYER1_FRONT = clamp(
  PLAYER_SPAWN_OFFSET,
  RING_MIN_X,
  RING_MAX_X,
);
export const SPAWN_X_PLAYER1_BACK = clamp(
  PLAYER_SPAWN_OFFSET / 2,
  RING_MIN_X,
  RING_MAX_X,
);
export const SPAWN_X_PLAYER2_FRONT = clamp(
  FIELD_WIDTH - PLAYER_SPAWN_OFFSET - PLAYER_SIZE,
  RING_MIN_X,
  RING_MAX_X,
);
export const SPAWN_X_PLAYER2_BACK = clamp(
  FIELD_WIDTH - PLAYER_SPAWN_OFFSET / 2 - PLAYER_SIZE,
  RING_MIN_X,
  RING_MAX_X,
);

export const DEFAULT_ARENA_COLORS: ArenaColors = {
  ringMat: "#e5e7eb",
  ringMarkings: "#9ca3af",
  ringRopePrimary: "#dc2626",
  ringRopeSecondary: "#1d4ed8",
  cornerRed: "#dc2626",
  cornerBlue: "#2563eb",
  postBody: "#94a3b8",
  postTop: "#e2e8f0",
};

export const PLAYER_KEYS: PlayerKey[] = [
  "player1Front",
  "player1Back",
  "player2Front",
  "player2Back",
];

export const IDLE_FRAME_MIN_MS = 350;
export const IDLE_FRAME_MAX_MS = 800;

export const FIGHTER_SLOTS: Array<{
  slotKey: PlayerKey;
  team: Team;
  position: Position;
  botId: string;
  botLabel: string;
}> = [
  {
    slotKey: "player1Front",
    team: "team1",
    position: "front",
    botId: "bot-team1-front",
    botLabel: "Coder Bot α",
  },
  {
    slotKey: "player1Back",
    team: "team1",
    position: "back",
    botId: "bot-team1-back",
    botLabel: "Coder Bot β",
  },
  {
    slotKey: "player2Front",
    team: "team2",
    position: "front",
    botId: "bot-team2-front",
    botLabel: "Reviewer Bot α",
  },
  {
    slotKey: "player2Back",
    team: "team2",
    position: "back",
    botId: "bot-team2-back",
    botLabel: "Reviewer Bot β",
  },
];

export const BOT_FOLLOW_DISTANCE = 150;
export const BOT_RETREAT_DISTANCE = 78;
export const BOT_DEFEND_DISTANCE = 68;
export const BOT_PUNCH_DISTANCE = 70;
export const BOT_STRAFE_DISTANCE = 210;
export const BOT_APPROACH_INTENT = 0.18;
export const BOT_STRAFE_INTENT = 0.22;
export const BOT_PUNCH_WINDOW_MS = 420;
export const BOT_DEFEND_WINDOW_MS = 260;

export const TEAM1_COLOR = "#dc2626";
export const TEAM2_COLOR = "#2563eb";
