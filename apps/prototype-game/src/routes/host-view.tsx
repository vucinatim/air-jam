import {
  AirJamOverlay,
  useAirJamHost,
  useAudio,
  type ControllerInputEvent,
  type PlayerProfile,
} from "@air-jam/sdk";
import { Settings2, X } from "lucide-react";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { Button } from "../components/ui/button";
import { DebugOverlay } from "../game/components/DebugOverlay";
import {
  BotsSection,
  CTFDebugSection,
  PlayersSection,
  SceneInfoSection,
} from "../game/components/DebugSections";
import { GameObjectEditor } from "../game/components/GameObjectEditor";
import { GameScene } from "../game/components/GameScene";
import { PlayerHUDOverlay } from "../game/components/PlayerHUDOverlay";
import { ScoreDisplay } from "../game/components/ScoreDisplay";
import { useGameStore } from "../game/game-store";
import { useBackgroundMusic } from "../game/hooks/useBackgroundMusic";
import { SOUND_MANIFEST } from "../game/sounds";

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
    [applyInput],
  );

  const handlePlayerJoin = useCallback(
    (player: PlayerProfile) => {
      upsertPlayer(player, player.id);
      // Play player join sound on host
      audio.play("player_join");
    },
    [upsertPlayer, audio],
  );

  const handlePlayerLeave = useCallback(
    (controllerId: string) => {
      removePlayer(controllerId);
    },
    [removePlayer],
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
    <div className="bg-background relative h-screen w-screen overflow-hidden">
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
      <div className="relative flex h-full w-full">
        {/* Game View */}
        <div
          className={`relative h-full transition-all duration-300 ${
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
          <div className="border-border bg-background flex h-full w-1/2 flex-col border-l">
            <div className="border-border shrink-0 border-b px-6 py-4">
              <h2 className="text-lg font-semibold">
                Game Object Editor -{" "}
                {editorObjectType.charAt(0).toUpperCase() +
                  editorObjectType.slice(1)}
              </h2>
            </div>
            <div className="min-h-0 flex-1">
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
