import type { TeamAssignment } from "../../store";
import type { TeamId } from "../../shared/team";
import {
  BALL_SIZE,
  FIELD_HEIGHT,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  type PaddlePosition,
} from "./constants";
import type { RuntimePlayer, RuntimeState } from "./types";

export interface TeamPaddleState {
  hasFront: boolean;
  hasBack: boolean;
}

export const clampPaddleY = (y: number): number =>
  Math.max(0, Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, y));

export const getTeamPaddleState = (
  players: RuntimePlayer[],
  teamAssignments: Record<string, TeamAssignment>,
  botTeam: TeamId | null,
): Record<TeamId, TeamPaddleState> => {
  const hasHumanTeam1Front = players.some(
    (player) =>
      teamAssignments[player.id]?.team === "team1" &&
      teamAssignments[player.id]?.position === "front",
  );
  const hasHumanTeam1Back = players.some(
    (player) =>
      teamAssignments[player.id]?.team === "team1" &&
      teamAssignments[player.id]?.position === "back",
  );
  const hasHumanTeam2Front = players.some(
    (player) =>
      teamAssignments[player.id]?.team === "team2" &&
      teamAssignments[player.id]?.position === "front",
  );
  const hasHumanTeam2Back = players.some(
    (player) =>
      teamAssignments[player.id]?.team === "team2" &&
      teamAssignments[player.id]?.position === "back",
  );

  return {
    team1: {
      hasFront: botTeam === "team1" || hasHumanTeam1Front,
      hasBack: botTeam === "team1" ? false : hasHumanTeam1Back,
    },
    team2: {
      hasFront: botTeam === "team2" || hasHumanTeam2Front,
      hasBack: botTeam === "team2" ? false : hasHumanTeam2Back,
    },
  };
};

export const getPaddleControllerId = (
  players: RuntimePlayer[],
  teamAssignments: Record<string, TeamAssignment>,
  team: TeamId,
  position: PaddlePosition,
): string | null => {
  for (const player of players) {
    const assignment = teamAssignments[player.id];
    if (assignment?.team === team && assignment.position === position) {
      return player.id;
    }
  }
  return null;
};

export const applyHumanPaddleInput = (
  state: RuntimeState,
  players: RuntimePlayer[],
  teamAssignments: Record<string, TeamAssignment>,
  getInput: (playerId: string) => { direction?: number } | undefined,
  botTeam: TeamId | null,
): void => {
  players.forEach((player) => {
    const assignment = teamAssignments[player.id];
    if (!assignment) {
      return;
    }

    const direction = getInput(player.id)?.direction ?? 0;
    if (botTeam !== null && assignment.team === botTeam) {
      return;
    }

    if (assignment.team === "team1") {
      if (assignment.position === "front") {
        state.paddle1FrontY = clampPaddleY(
          state.paddle1FrontY + direction * PADDLE_SPEED,
        );
      } else {
        state.paddle1BackY = clampPaddleY(
          state.paddle1BackY + direction * PADDLE_SPEED,
        );
      }
      return;
    }

    if (assignment.position === "front") {
      state.paddle2FrontY = clampPaddleY(
        state.paddle2FrontY + direction * PADDLE_SPEED,
      );
    } else {
      state.paddle2BackY = clampPaddleY(
        state.paddle2BackY + direction * PADDLE_SPEED,
      );
    }
  });
};

export const applyBotPaddleInput = (
  state: RuntimeState,
  botTeam: TeamId | null,
): void => {
  if (botTeam === null) {
    return;
  }

  const targetY = state.ballY + BALL_SIZE / 2 - PADDLE_HEIGHT / 2;
  if (botTeam === "team1") {
    const nextFront =
      state.paddle1FrontY < targetY
        ? state.paddle1FrontY + PADDLE_SPEED * 0.9
        : state.paddle1FrontY - PADDLE_SPEED * 0.9;
    state.paddle1FrontY = clampPaddleY(nextFront);
    return;
  }

  const nextFront =
    state.paddle2FrontY < targetY
      ? state.paddle2FrontY + PADDLE_SPEED * 0.9
      : state.paddle2FrontY - PADDLE_SPEED * 0.9;
  state.paddle2FrontY = clampPaddleY(nextFront);
};
