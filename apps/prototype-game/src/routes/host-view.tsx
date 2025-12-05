import type { JSX } from "react";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  AirJamOverlay,
  useAirJamHost,
  type ControllerInputEvent,
  type PlayerProfile,
} from "@air-jam/sdk";
import { useAudio } from "@air-jam/sdk";
import { SOUND_MANIFEST } from "../game/sounds";
import { useBackgroundMusic } from "../game/hooks/useBackgroundMusic";
import { GameScene } from "../game/components/GameScene";
import { useGameStore } from "../game/game-store";
import { PlayerHUDOverlay } from "../game/components/PlayerHUDOverlay";
import { DebugOverlay } from "../game/components/DebugOverlay";
import {
  PlayersSection,
  SceneInfoSection,
  BotsSection,
  CTFDebugSection,
} from "../game/components/DebugSections";
import { GameObjectEditor } from "../game/components/GameObjectEditor";
import { ScoreDisplay } from "../game/components/ScoreDisplay";
import { Button } from "../components/ui/button";
import { Settings2, X } from "lucide-react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";

const HostViewContent = (): JSX.Element => {
  const applyInput = useGameStore((state) => state.applyInput);
  const upsertPlayer = useGameStore((state) => state.upsertPlayer);
  const removePlayer = useGameStore((state) => state.removePlayer);
  const audio = useAudio(SOUND_MANIFEST);

  // Start background music
  useBackgroundMusic(true);

  const handleInput = useCallback(
    (event: ControllerInputEvent) => {
      applyInput(event);
    },
    [applyInput]
  );

  const handlePlayerJoin = useCallback(
    (player: PlayerProfile) => {
      upsertPlayer(player, player.id);
      // Play player join sound on host
      audio.play("player_join");
    },
    [upsertPlayer, audio]
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
    apiKey: import.meta.env.VITE_AIR_JAM_API_KEY,
    serverUrl: import.meta.env.VITE_AIR_JAM_SERVER_URL,
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

  const [cameras, setCameras] = useState<
    Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>
  >([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorObjectType] = useState<
    "rocket" | "laser" | "ship" | "collectible" | "flag"
  >("flag");

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
        isChildMode={host.isChildMode}
      />
      <ScoreDisplay />
      <DebugOverlay>
        <PlayersSection />
        <BotsSection />
        <CTFDebugSection />
        <SceneInfoSection />
      </DebugOverlay>
      {/* Editor Button */}
      <div className="absolute top-14 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsEditorOpen(!isEditorOpen)}
          className="bg-background/80 backdrop-blur-sm"
        >
          {isEditorOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Settings2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="flex h-full w-full relative">
        {/* Game View */}
        <div
          className={`h-full relative transition-all duration-300 ${
            isEditorOpen ? "w-1/2" : "w-full"
          }`}
        >
          <GameScene onCamerasReady={setCameras} />
          {cameras.length > 0 && canvasRef.current && (
            <PlayerHUDOverlay
              canvasElement={canvasRef.current}
              cameras={cameras}
            />
          )}
        </div>
        {/* Editor View */}
        {isEditorOpen && (
          <div className="w-1/2 h-full border-l border-border bg-background flex flex-col">
            <div className="px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold">
                Game Object Editor -{" "}
                {editorObjectType.charAt(0).toUpperCase() +
                  editorObjectType.slice(1)}
              </h2>
            </div>
            <div className="flex-1 min-h-0">
              <GameObjectEditor objectType={editorObjectType} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const HostView = (): JSX.Element => {
  return <HostViewContent />;
};
