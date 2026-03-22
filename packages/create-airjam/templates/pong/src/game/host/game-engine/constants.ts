import type { TeamId } from "../../shared/team";
import { getTeamColor } from "../../shared/team";

export const FIELD_WIDTH = 1000;
export const FIELD_HEIGHT = 600;
export const PADDLE_HEIGHT = 100;
export const PADDLE_WIDTH = 15;
export const PADDLE_OFFSET = 30;
export const BALL_SIZE = 15;
export const PADDLE_SPEED = 6;
export const BALL_SPEED = 3;

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

export const TEAM1_COLOR = getTeamColor("team1");
export const TEAM2_COLOR = getTeamColor("team2");
