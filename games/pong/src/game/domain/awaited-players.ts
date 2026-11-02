import type { PlayerProfile } from "@air-jam/sdk/protocol";
import type { TeamAssignment } from "../stores/pong-store-types";

/**
 * Seated players whose phone dropped and is trying to resume. A match waits
 * for them rather than letting the other side score against an empty paddle.
 */
export const getAwaitedPlayers = (
  players: readonly PlayerProfile[],
  reconnectingPlayerIds: readonly string[],
  teamAssignments: Record<string, TeamAssignment>,
): PlayerProfile[] =>
  players.filter(
    (player) =>
      player.id in teamAssignments && reconnectingPlayerIds.includes(player.id),
  );
