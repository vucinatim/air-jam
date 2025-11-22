import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AirJamOverlay,
  useAirJamHost,
  type ControllerInputEvent,
  type PlayerProfile,
} from "@air-jam/sdk";
import { GameScene } from "../game/game-scene";

export const HostView = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<GameScene | null>(null);

  const handleInput = useCallback((event: ControllerInputEvent) => {
    sceneRef.current?.handleInput(event);
  }, []);

  const handlePlayerJoin = useCallback((player: PlayerProfile) => {
    sceneRef.current?.addPlayer(player);
  }, []);

  const handlePlayerLeave = useCallback((controllerId: string) => {
    sceneRef.current?.removePlayer(controllerId);
  }, []);

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
    if (!containerRef.current) {
      return undefined;
    }
    const scene = new GameScene(containerRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    host.players.forEach((player) => sceneRef.current?.addPlayer(player));
  }, [host.players]);

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
      <div id="canvas-container" ref={containerRef} className="h-full w-full" />
    </div>
  );
};
