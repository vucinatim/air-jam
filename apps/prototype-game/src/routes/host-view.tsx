import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AirJamOverlay,
  useAirJamHost,
  type ControllerInputEvent,
  type PlayerProfile,
} from "@air-jam/sdk";
import { GameScene } from "../game/components/GameScene";
import { useGameStore } from "../game/game-store";
import { PhysicsRecorderUI } from "../components/PhysicsRecorderUI";

export const HostView = (): JSX.Element => {
  const applyInput = useGameStore((state) => state.applyInput);
  const upsertPlayer = useGameStore((state) => state.upsertPlayer);
  const removePlayer = useGameStore((state) => state.removePlayer);

  const handleInput = useCallback(
    (event: ControllerInputEvent) => {
      applyInput(event);
    },
    [applyInput]
  );

  const handlePlayerJoin = useCallback(
    (player: PlayerProfile) => {
      upsertPlayer(player, player.id);
    },
    [upsertPlayer]
  );

  const handlePlayerLeave = useCallback(
    (controllerId: string) => {
      removePlayer(controllerId);
    },
    [removePlayer]
  );

  const [persistedRoomId] = useState(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("airjam_room_id") || undefined;
    }
    return undefined;
  });

  const host = useAirJamHost({
    roomId: persistedRoomId,
    onInput: handleInput,
    onPlayerJoin: handlePlayerJoin,
    onPlayerLeave: handlePlayerLeave,
    controllerPath: "/joypad",
  });

  useEffect(() => {
    if (host.roomId && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("airjam_room_id", host.roomId);
    }
  }, [host.roomId]);

  useEffect(() => {
    const activeIds = new Set(host.players.map((player) => player.id));
    host.players.forEach((player) => upsertPlayer(player, player.id));
    const currentPlayers = useGameStore.getState().players;
    currentPlayers.forEach((player) => {
      if (!activeIds.has(player.controllerId)) {
        removePlayer(player.controllerId);
      }
    });
  }, [host.players, upsertPlayer, removePlayer]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background ">
      <AirJamOverlay
        roomId={host.roomId}
        joinUrl={host.joinUrl}
        connectionStatus={host.connectionStatus}
        players={host.players}
        lastError={host.lastError}
        gameState={host.gameState}
        onTogglePlayPause={host.toggleGameState}
      />
      <PhysicsRecorderUI />
      <div className="h-full w-full">
        <GameScene />
      </div>
    </div>
  );
};
