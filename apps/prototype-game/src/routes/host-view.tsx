import {
  useAirJamHost,
  useAudio,
  type PlayerProfile,
} from "@air-jam/sdk";
import { Settings2, X } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
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
  const upsertPlayer = useGameStore((state) => state.upsertPlayer);
  const removePlayer = useGameStore((state) => state.removePlayer);
  const audio = useAudio(SOUND_MANIFEST);

  // Start background music
  useBackgroundMusic(true);

  const host = useAirJamHost({
    onPlayerJoin: (player: PlayerProfile) => {
      upsertPlayer(player, player.id);
      // Play player join sound on host
      audio.play("player_join");
    },
    onPlayerLeave: (controllerId: string) => {
      removePlayer(controllerId);
    },
  });
  const { players, roomId, connectionStatus, gameState, toggleGameState } = host;

  useEffect(() => {
    const activeIds = new Set(players.map((player) => player.id));
    players.forEach((player) => upsertPlayer(player, player.id));
    const currentPlayers = useGameStore.getState().players;
    currentPlayers.forEach((player) => {
      if (!activeIds.has(player.controllerId)) {
        removePlayer(player.controllerId);
      }
    });
  }, [players, upsertPlayer, removePlayer]);

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
      <header className="absolute top-0 right-0 left-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3 text-xs uppercase">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connectionStatus === "connected"
                ? "bg-emerald-400"
                : connectionStatus === "connecting" ||
                    connectionStatus === "reconnecting"
                  ? "bg-amber-300"
                  : "bg-rose-400"
            }`}
          />
          <span>
            Room <span className="font-semibold tracking-wider">{roomId || "----"}</span>
          </span>
          <span>
            Players <span className="font-semibold">{players.length}</span>
          </span>
        </div>
        <button
          type="button"
          className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
          onClick={toggleGameState}
        >
          {gameState === "playing" ? "Pause" : "Resume"}
        </button>
      </header>

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

      <div className="relative flex h-full w-full pt-10">
        {/* Game View */}
        <div
          className={`relative h-full transition-all duration-300 ${
            isEditorOpen ? "w-1/2" : "w-full"
          }`}
        >
          <GameScene onCamerasReady={setCameras} />
          {cameras.length > 0 && canvasRef.current && (
            <PlayerHUDOverlay canvasElement={canvasRef.current} cameras={cameras} />
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
