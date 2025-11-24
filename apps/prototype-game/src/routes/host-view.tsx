import type { JSX } from "react";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  AirJamOverlay,
  useAirJamHost,
  type ControllerInputEvent,
  type PlayerProfile,
} from "@air-jam/sdk";
import { GameScene } from "../game/components/GameScene";
import { useGameStore } from "../game/game-store";
import { PlayerHUDOverlay } from "../game/components/PlayerHUDOverlay";
import { DebugOverlay } from "../game/components/DebugOverlay";
import { PlayersSection, SceneInfoSection } from "../game/components/DebugSections";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";

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

  const [cameras, setCameras] = useState<Array<{ camera: ThreePerspectiveCamera; viewport: { x: number; y: number; width: number; height: number } }>>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Find the canvas element
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvasRef.current = canvas;
    }
  }, []);

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
      <DebugOverlay>
        <PlayersSection />
        <SceneInfoSection />
      </DebugOverlay>
      <div className="h-full w-full relative">
        <GameScene onCamerasReady={setCameras} />
        {cameras.length > 0 && canvasRef.current && (
          <PlayerHUDOverlay canvasElement={canvasRef.current} cameras={cameras} />
        )}
      </div>
    </div>
  );
};
