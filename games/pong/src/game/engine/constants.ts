import type { TeamId } from "../domain/team";
import { resolvePongArenaProps } from "../prefabs/arena";

const arenaProps = resolvePongArenaProps();

export const FIELD_WIDTH = arenaProps.fieldWidth;
export const FIELD_HEIGHT = arenaProps.fieldHeight;
export const PADDLE_HEIGHT = 100;
export const PADDLE_WIDTH = 15;
export const PADDLE_OFFSET = 30;
export const BALL_SIZE = 15;
export const PADDLE_SPEED = 720; // pixels per second
export const BALL_SPEED = 360; // pixels per second
export const FIELD_BACKGROUND_COLOR = arenaProps.backgroundColor;
export const FIELD_CENTER_LINE_COLOR = arenaProps.centerLineColor;

export type PaddlePosition = "front" | "back";

export const PADDLE_X: Record<TeamId, Record<PaddlePosition, number>> = {
  team1: {
    front: PADDLE_OFFSET,
    back: PADDLE_OFFSET / 2,
  },
  team2: {
    front: FIELD_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH,
    back: FIELD_WIDTH - PADDLE_OFFSET / 2 - PADDLE_WIDTH,
  },
};

export const TEAM1_COLOR = arenaProps.teamColors.team1;
export const TEAM2_COLOR = arenaProps.teamColors.team2;
