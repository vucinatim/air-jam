import type { TeamAssignment } from "../../store";
import type { TeamId } from "../../shared/team";

export interface RuntimePlayer {
  id: string;
}

export interface RuntimeState {
  paddle1FrontY: number;
  paddle1BackY: number;
  paddle2FrontY: number;
  paddle2BackY: number;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  lastTouchedTeam: TeamId | null;
}

export interface StepGameOptions {
  state: RuntimeState;
  players: RuntimePlayer[];
  teamAssignments: Record<string, TeamAssignment>;
  getInput: (playerId: string) => { direction?: number } | undefined;
  isPlaying: boolean;
  countdown: number | null;
  botTeam: TeamId | null;
  onPaddleHit?: (event: { team: TeamId; playerId: string | null }) => void;
  onScore: (team: TeamId) => void;
}

export interface DrawFrameOptions {
  ctx: CanvasRenderingContext2D;
  state: RuntimeState;
  players: RuntimePlayer[];
  teamAssignments: Record<string, TeamAssignment>;
  countdown: number | null;
  botTeam: TeamId | null;
}
