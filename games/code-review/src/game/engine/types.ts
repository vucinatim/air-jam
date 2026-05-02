import type { Position, Team } from "../domain/team-assignments";

export type PlayerKey =
  | "player1Front"
  | "player1Back"
  | "player2Front"
  | "player2Back";

export type SpriteVariant =
  | "LeftShort"
  | "RightShort"
  | "LeftExtended"
  | "RightExtended"
  | "Defend"
  | "End";

export type SpriteKey = `${"team1" | "team2"}${SpriteVariant}`;
export type SpriteTintCacheKey = `${SpriteKey}:${string}`;

export type ArenaColors = {
  ringMat: string;
  ringMarkings: string;
  ringRopePrimary: string;
  ringRopeSecondary: string;
  cornerRed: string;
  cornerBlue: string;
  postBody: string;
  postTop: string;
};

export type SlotParticipant = {
  id: string;
  label: string;
  slotKey: PlayerKey;
  team: Team;
  position: Position;
  isBot: boolean;
};

export type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  punchingLeft: boolean;
  punchingRight: boolean;
  cooldownLeft: number;
  cooldownRight: number;
  punchEndLeft: number;
  punchEndRight: number;
  punchLandedLeft: boolean;
  punchLandedRight: boolean;
  knockbackFrames: number;
  defending: boolean;
  hitFlashEnd: number;
  idleLeft: boolean;
  idleNextSwap: number;
  empoweredUntil: number;
  punchEmpowered: boolean;
};

export type RuntimePlayerState = Record<PlayerKey, PlayerState>;

export type HpState = {
  team1: number;
  team2: number;
};

export type KoState = {
  active: boolean;
  winner: Team | null;
  endTime: number;
};
