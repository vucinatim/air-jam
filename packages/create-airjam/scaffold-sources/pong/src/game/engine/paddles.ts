import type { TeamId } from "../domain/team";
import {
  getBotPositions,
  type BotCounts,
  type PaddleSlotPosition,
} from "../domain/team-slots";
import type { TeamAssignment } from "../stores";
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
  botCounts: BotCounts,
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
      hasFront:
        hasHumanTeam1Front ||
        getBotPositions(teamAssignments, botCounts, "team1").includes("front"),
      hasBack:
        hasHumanTeam1Back ||
        getBotPositions(teamAssignments, botCounts, "team1").includes("back"),
    },
    team2: {
      hasFront:
        hasHumanTeam2Front ||
        getBotPositions(teamAssignments, botCounts, "team2").includes("front"),
      hasBack:
        hasHumanTeam2Back ||
        getBotPositions(teamAssignments, botCounts, "team2").includes("back"),
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
  deltaSeconds: number,
): void => {
  players.forEach((player) => {
    const assignment = teamAssignments[player.id];
    if (!assignment) {
      return;
    }

    const direction = getInput(player.id)?.direction ?? 0;

    if (assignment.team === "team1") {
      if (assignment.position === "front") {
        state.paddle1FrontY = clampPaddleY(
          state.paddle1FrontY + direction * PADDLE_SPEED * deltaSeconds,
        );
      } else {
        state.paddle1BackY = clampPaddleY(
          state.paddle1BackY + direction * PADDLE_SPEED * deltaSeconds,
        );
      }
      return;
    }

    if (assignment.position === "front") {
      state.paddle2FrontY = clampPaddleY(
        state.paddle2FrontY + direction * PADDLE_SPEED * deltaSeconds,
      );
    } else {
      state.paddle2BackY = clampPaddleY(
        state.paddle2BackY + direction * PADDLE_SPEED * deltaSeconds,
      );
    }
  });
};

const applyBotDirection = (
  state: RuntimeState,
  team: TeamId,
  position: PaddleSlotPosition,
  targetY: number,
  deltaSeconds: number,
): void => {
  const key =
    team === "team1"
      ? position === "front"
        ? "paddle1FrontY"
        : "paddle1BackY"
      : position === "front"
        ? "paddle2FrontY"
        : "paddle2BackY";
  const currentY = state[key];
  const nextY =
    currentY < targetY
      ? currentY + PADDLE_SPEED * 0.9 * deltaSeconds
      : currentY - PADDLE_SPEED * 0.9 * deltaSeconds;
  state[key] = clampPaddleY(nextY);
};

export const applyBotPaddleInput = (
  state: RuntimeState,
  teamAssignments: Record<string, TeamAssignment>,
  botCounts: BotCounts,
  deltaSeconds: number,
): void => {
  const targetY = state.ballY + BALL_SIZE / 2 - PADDLE_HEIGHT / 2;
  (["team1", "team2"] as const).forEach((team) => {
    getBotPositions(teamAssignments, botCounts, team).forEach((position) => {
      applyBotDirection(state, team, position, targetY, deltaSeconds);
    });
  });
};
