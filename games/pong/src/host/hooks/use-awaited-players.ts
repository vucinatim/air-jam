import { useAirJamHost, useAirJamStore } from "@air-jam/sdk";
import { getReconnectingPlayerIds } from "@air-jam/sdk/core";
import { getAwaitedPlayers } from "../../game/domain/awaited-players";
import { pongStore } from "../../game/stores";

/** Seated players the running match is holding for, the same rule the simulation follows. */
export const useAwaitedPlayers = () => {
  const players = useAirJamHost((state) => state.players);
  const reconnectingPlayerIds = useAirJamHost((state) =>
    getReconnectingPlayerIds(state.players, state.controllers),
  );
  const matchPhase = useAirJamStore(pongStore, (state) => state.matchPhase);
  const teamAssignments = useAirJamStore(
    pongStore,
    (state) => state.teamAssignments,
  );
  return matchPhase === "playing"
    ? getAwaitedPlayers(players, reconnectingPlayerIds, teamAssignments)
    : [];
};
