import {
  useAirJamHost,
  useAudio,
  useHostGameStateBridge,
  type PlayerProfile,
} from "@air-jam/sdk";
import { PlayerAvatar, RoomQrCode } from "@air-jam/sdk/ui";
import { Settings2, Volume2, VolumeX, X } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { Button } from "../components/ui/button";
import { useBotManager } from "../game/bot-system/bot-manager";
import {
  TEAM_CONFIG,
  useCaptureTheFlagStore,
  type TeamId,
} from "../game/capture-the-flag-store";
import { DebugOverlay } from "../game/components/debug-overlay";
import {
  BotsSection,
  CTFDebugSection,
  PlayersSection,
  SceneInfoSection,
} from "../game/components/debug-sections";
import { GameObjectEditor } from "../game/components/game-object-editor";
import { GameScene } from "../game/components/game-scene";
import { PlayerHUDOverlay } from "../game/components/player-hud-overlay";
import { ScoreDisplay } from "../game/components/score-display";
import { useGameStore } from "../game/game-store";
import { useBackgroundMusic } from "../game/hooks/use-background-music";
import {
  getLobbyReadinessText,
  getTeamCounts,
  type TeamCounts,
} from "../game/match-readiness";
import { usePrototypeMatchStore, type MatchSummary } from "../game/match-store";
import { SOUND_MANIFEST } from "../game/sounds";

interface TeamCardProps {
  teamId: TeamId;
  players: PlayerProfile[];
  botCount: number;
}

const TeamCard = ({ teamId, players, botCount }: TeamCardProps) => {
  const team = TEAM_CONFIG[teamId];
  const totalCount = players.length + botCount;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
      <div
        className="text-2xl font-black tracking-wide uppercase"
        style={{ color: team.color }}
      >
        {team.label}
      </div>
      <div className="flex min-h-8 items-center justify-center gap-2">
        {players.length > 0 ? (
          players.map((player) => (
            <PlayerAvatar
              key={player.id}
              player={player}
              size="sm"
              className="h-7 w-7 border-2"
            />
          ))
        ) : (
          <span className="text-xs tracking-wide text-zinc-500 uppercase">
            Empty
          </span>
        )}
        {botCount > 0 ? (
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-200 uppercase">
            BOT x{botCount}
          </span>
        ) : null}
      </div>
      <div className="text-sm font-bold tracking-wide text-zinc-300 uppercase">
        {totalCount}
      </div>
    </div>
  );
};

interface LobbyOverlayProps {
  joinQrValue: string;
  roomId: string | null;
  pointsToWin: number;
  botCounts: TeamCounts;
  connectionStatus:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "reconnecting";
  lastError?: string;
  connectedPlayers: PlayerProfile[];
  teamPlayers: Record<TeamId, PlayerProfile[]>;
}

const LobbyOverlay = ({
  joinQrValue,
  roomId,
  pointsToWin,
  botCounts,
  connectionStatus,
  lastError,
  connectedPlayers,
  teamPlayers,
}: LobbyOverlayProps): JSX.Element => {
  const humanCounts = getTeamCounts([
    ...teamPlayers.solaris.map(() => ({ teamId: "solaris" as const })),
    ...teamPlayers.nebulon.map(() => ({ teamId: "nebulon" as const })),
  ]);

  const readinessText = getLobbyReadinessText(
    humanCounts,
    botCounts,
    pointsToWin,
  );

  const hasJoinQr = joinQrValue.trim().length > 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 py-10 text-white">
      <div className="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <div className="space-y-1">
          <div className="text-xs tracking-[0.22em] text-zinc-400 uppercase">
            Prototype Lobby
          </div>
          <h1 className="text-5xl font-black tracking-tight uppercase">
            Join Room
          </h1>
          <div className="text-xl font-bold tracking-[0.2em] text-zinc-200 uppercase">
            {roomId ?? "----"}
          </div>
        </div>

        {hasJoinQr ? (
          <RoomQrCode
            value={joinQrValue}
            size={220}
            className="rounded-md bg-white"
            alt="Join this prototype room"
          />
        ) : (
          <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 rounded-md border border-white/20 bg-black/40 px-4 text-center">
            <div className="text-[11px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">
              Join URL unavailable
            </div>
            <div className="text-[11px] text-zinc-400">
              {connectionStatus === "connected"
                ? "Room is not ready yet."
                : `Host status: ${connectionStatus}`}
            </div>
            {lastError ? (
              <div className="text-[11px] text-rose-300">{lastError}</div>
            ) : null}
          </div>
        )}

        <div className="text-xs tracking-[0.14em] text-zinc-300 uppercase">
          {readinessText}
        </div>

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          <TeamCard
            teamId="solaris"
            players={teamPlayers.solaris}
            botCount={botCounts.solaris}
          />
          <TeamCard
            teamId="nebulon"
            players={teamPlayers.nebulon}
            botCount={botCounts.nebulon}
          />
        </div>

        <div className="flex min-h-9 flex-col items-center justify-center gap-3">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
            Connected
          </div>
          {connectedPlayers.length > 0 ? (
            <div className="flex items-center justify-center gap-2">
              {connectedPlayers.map((player) => (
                <PlayerAvatar
                  key={player.id}
                  player={player}
                  size="sm"
                  className="h-7 w-7 border-2"
                />
              ))}
            </div>
          ) : (
            <span className="text-xs tracking-wide text-zinc-500 uppercase">
              Waiting for players
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface EndedOverlayProps {
  roomId: string | null;
  matchSummary: MatchSummary | null;
  botCounts: TeamCounts;
  teamPlayers: Record<
    TeamId,
    Array<{ id: string; label: string; color?: string }>
  >;
}

const EndedOverlay = ({
  roomId,
  matchSummary,
  botCounts,
  teamPlayers,
}: EndedOverlayProps): JSX.Element => {
  const winner = matchSummary?.winner;
  const winnerLabel = winner
    ? `${TEAM_CONFIG[winner].label} Wins`
    : "Match Ended";
  const winnerColor = winner ? TEAM_CONFIG[winner].color : "#ffffff";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 py-10 text-white">
      <div className="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <div className="space-y-1">
          <div className="text-xs tracking-[0.22em] text-zinc-400 uppercase">
            Match Ended
          </div>
          <h1
            className="text-5xl font-black tracking-tight uppercase"
            style={{ color: winnerColor }}
          >
            {winnerLabel}
          </h1>
          <div className="text-xl font-bold tracking-[0.2em] text-zinc-200 uppercase">
            {roomId ?? "----"}
          </div>
        </div>

        <div className="text-6xl font-black tracking-tight text-white">
          {matchSummary ? (
            <>
              <span style={{ color: TEAM_CONFIG.solaris.color }}>
                {matchSummary.finalScores.solaris}
              </span>
              <span className="px-2 text-zinc-500">:</span>
              <span style={{ color: TEAM_CONFIG.nebulon.color }}>
                {matchSummary.finalScores.nebulon}
              </span>
            </>
          ) : (
            "0:0"
          )}
        </div>

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          <TeamCard
            teamId="solaris"
            players={teamPlayers.solaris}
            botCount={botCounts.solaris}
          />
          <TeamCard
            teamId="nebulon"
            players={teamPlayers.nebulon}
            botCount={botCounts.nebulon}
          />
        </div>

        <div className="text-xs tracking-[0.14em] text-zinc-300 uppercase">
          {matchSummary
            ? `First to ${matchSummary.pointsToWin}. Duration ${formatDuration(matchSummary.durationMs)}.`
            : "Match complete."}
        </div>
        <div className="text-xs tracking-[0.14em] text-zinc-500 uppercase">
          Restart or return to lobby from controller.
        </div>
      </div>
    </div>
  );
};

interface MatchBackdropProps {
  children: JSX.Element;
  topRightSlot?: JSX.Element;
}

const MatchBackdrop = ({
  children,
  topRightSlot,
}: MatchBackdropProps): JSX.Element => {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute inset-0 [&>canvas]:scale-110 [&>canvas]:blur-lg [&>canvas]:brightness-40">
        <GameScene mode="spectator" paused={true} />
      </div>
      <div className="absolute inset-0 bg-radial from-transparent to-black/70" />
      {topRightSlot}
      {children}
    </div>
  );
};

const PausedOverlay = ({
  roomId,
  joinQrValue,
  connectionStatus,
  lastError,
}: {
  roomId: string | null;
  joinQrValue: string;
  connectionStatus:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "reconnecting";
  lastError?: string;
}) => (
  <div className="pointer-events-none absolute inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-xl border border-white/15 bg-black/70 px-6 py-5 text-center text-white">
      <div className="text-xs tracking-[0.2em] text-zinc-400 uppercase">
        Paused
      </div>
      <div className="text-2xl font-black tracking-wide uppercase">
        Room {roomId ?? "----"}
      </div>
      {joinQrValue.trim().length > 0 ? (
        <RoomQrCode
          value={joinQrValue}
          size={140}
          className="rounded-md bg-white"
          alt="Join this prototype room"
        />
      ) : (
        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-md border border-white/20 bg-black/40 px-3 text-center text-[11px] text-zinc-300">
          {lastError
            ? lastError
            : connectionStatus === "connected"
              ? "Room not ready"
              : `Host ${connectionStatus}`}
        </div>
      )}
      <div className="text-[11px] tracking-[0.14em] text-zinc-300 uppercase">
        Resume from any controller
      </div>
    </div>
  </div>
);

const HostMuteButton = ({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}): JSX.Element => (
  <Button
    type="button"
    variant="outline"
    size="icon"
    onClick={onToggle}
    aria-label={muted ? "Unmute audio" : "Mute audio"}
    title={muted ? "Unmute" : "Mute"}
    className="border-white/20 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
  >
    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
  </Button>
);

const HostViewContent = (): JSX.Element => {
  const audio = useAudio(SOUND_MANIFEST);
  const [audioMuted, setAudioMuted] = useState(false);

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  useBackgroundMusic(!audioMuted);

  const host = useAirJamHost();
  const {
    players,
    roomId,
    connectionStatus,
    gameState,
    lastError,
    sendState,
    toggleGameState,
  } = host;

  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);
  const pointsToWin = usePrototypeMatchStore((state) => state.pointsToWin);
  const botCounts = usePrototypeMatchStore((state) => state.botCounts);
  const teamAssignments = usePrototypeMatchStore(
    (state) => state.teamAssignments,
  );
  const matchSummary = usePrototypeMatchStore((state) => state.matchSummary);
  const matchActions = usePrototypeMatchStore.useActions();

  const ctfScores = useCaptureTheFlagStore((state) => state.scores);
  const resetMatch = useCaptureTheFlagStore((state) => state.resetMatch);

  const gamePlayers = useGameStore((state) => state.players);
  const setPlayerTeam = useGameStore((state) => state.setPlayerTeam);
  const bumpRound = useGameStore((state) => state.bumpRound);

  const addBot = useBotManager((state) => state.addBot);
  const removeBot = useBotManager((state) => state.removeBot);

  useHostGameStateBridge({
    phase: matchPhase,
    playingPhase: "playing",
    gameState,
    toggleGameState,
    onEnterPlayingPhase: () => {
      resetMatch();
      bumpRound();
    },
    onPhaseTransition: ({ phase }) => {
      if (phase === "lobby") {
        resetMatch();
      }
    },
  });

  useEffect(() => {
    const store = useGameStore.getState();
    const connectedPlayers = store.players.filter(
      (player) => player.source === "connected",
    );
    const connectedIds = new Set(
      connectedPlayers.map((player) => player.controllerId),
    );
    const hostIds = new Set(players.map((player) => player.id));

    players.forEach((player) => {
      const isNewConnection = !connectedIds.has(player.id);
      store.upsertConnectedPlayer(player, player.id);
      if (isNewConnection) {
        audio.play("player_join");
      }
    });

    connectedPlayers.forEach((player) => {
      if (!hostIds.has(player.controllerId)) {
        store.removeConnectedPlayer(player.controllerId);
      }
    });
  }, [players, audio]);

  useEffect(() => {
    matchActions.syncConnectedPlayers({
      connectedPlayerIds: players.map((player) => player.id),
    });
  }, [matchActions, players]);

  useEffect(() => {
    const currentBotIdsByTeam: Record<TeamId, string[]> = {
      solaris: [],
      nebulon: [],
    };

    gamePlayers.forEach((player) => {
      if (player.source !== "bot") {
        return;
      }
      currentBotIdsByTeam[player.teamId].push(player.controllerId);
    });

    (Object.keys(TEAM_CONFIG) as TeamId[]).forEach((teamId) => {
      const desiredCount = botCounts[teamId];
      const idsForTeam = currentBotIdsByTeam[teamId];

      while (idsForTeam.length > desiredCount) {
        const botId = idsForTeam.pop();
        if (botId) {
          removeBot(botId);
        }
      }
    });

    (Object.keys(TEAM_CONFIG) as TeamId[]).forEach((teamId) => {
      const desiredCount = botCounts[teamId];
      const idsForTeam = currentBotIdsByTeam[teamId];

      while (idsForTeam.length < desiredCount) {
        const botId = addBot();
        idsForTeam.push(botId);
        setPlayerTeam(botId, teamId);
      }
    });
  }, [addBot, botCounts, gamePlayers, removeBot, setPlayerTeam]);

  useEffect(() => {
    gamePlayers.forEach((player) => {
      if (player.source === "connected") {
        const assignedTeam = teamAssignments[player.controllerId]?.teamId;
        if (assignedTeam) {
          setPlayerTeam(player.controllerId, assignedTeam);
        }
        return;
      }
    });
  }, [gamePlayers, setPlayerTeam, teamAssignments]);

  useEffect(() => {
    if (matchPhase !== "playing") {
      return;
    }

    const winner =
      ctfScores.solaris >= pointsToWin
        ? "solaris"
        : ctfScores.nebulon >= pointsToWin
          ? "nebulon"
          : null;

    if (!winner) {
      return;
    }

    matchActions.endMatch({
      winner,
      finalScores: {
        solaris: ctfScores.solaris,
        nebulon: ctfScores.nebulon,
      },
    });
    audio.play("success");
  }, [audio, ctfScores, matchActions, matchPhase, pointsToWin]);

  const connectedPlayers = useMemo(
    () => players,
    [players],
  );

  const teamPlayers = useMemo(() => {
    const grouped: Record<TeamId, PlayerProfile[]> = {
      solaris: [],
      nebulon: [],
    };

    players.forEach((player) => {
      const teamId = teamAssignments[player.id]?.teamId;
      if (!teamId) {
        return;
      }

      grouped[teamId].push(player);
    });

    return grouped;
  }, [players, teamAssignments]);

  const joinQrValue = useMemo(() => {
    if (host.joinUrl) {
      return host.joinUrl;
    }

    if (!host.roomId || typeof window === "undefined") {
      return "";
    }

    return new URL(
      `/controller?room=${host.roomId}`,
      window.location.origin,
    ).toString();
  }, [host.joinUrl, host.roomId]);

  const showPausedOverlay = matchPhase === "playing" && gameState !== "playing";
  const controllerOrientation =
    matchPhase === "playing" ? "landscape" : "portrait";

  useEffect(() => {
    if (connectionStatus !== "connected") {
      return;
    }

    sendState({
      orientation: controllerOrientation,
    });
  }, [connectionStatus, controllerOrientation, sendState]);

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
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvasRef.current = canvas;
    }
  }, [matchPhase]);

  const muteSlot = (
    <div className="pointer-events-auto absolute top-4 right-4 z-80">
      <HostMuteButton
        muted={audioMuted}
        onToggle={() => setAudioMuted((current) => !current)}
      />
    </div>
  );

  if (matchPhase === "lobby") {
    return (
      <MatchBackdrop topRightSlot={muteSlot}>
        <LobbyOverlay
          joinQrValue={joinQrValue}
          roomId={roomId}
          pointsToWin={pointsToWin}
          botCounts={botCounts}
          connectionStatus={connectionStatus}
          lastError={lastError}
          connectedPlayers={connectedPlayers}
          teamPlayers={teamPlayers}
        />
      </MatchBackdrop>
    );
  }

  if (matchPhase === "ended") {
    return (
      <MatchBackdrop topRightSlot={muteSlot}>
        <EndedOverlay
          roomId={roomId}
          matchSummary={matchSummary}
          botCounts={botCounts}
          teamPlayers={teamPlayers}
        />
      </MatchBackdrop>
    );
  }

  return (
    <div className="bg-background relative h-screen w-screen overflow-hidden">
      <ScoreDisplay />

      <DebugOverlay>
        <PlayersSection />
        <BotsSection />
        <CTFDebugSection />
        <SceneInfoSection />
      </DebugOverlay>

      <div className="absolute top-4 right-4 left-4 z-50 flex items-center justify-end gap-3 text-xs uppercase">
        <div className="mr-auto flex items-center gap-3">
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
          <span className="text-white/90">
            Room{" "}
            <span className="font-semibold tracking-wider">
              {roomId || "----"}
            </span>
          </span>
        </div>
        <HostMuteButton
          muted={audioMuted}
          onToggle={() => setAudioMuted((current) => !current)}
        />
      </div>

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
        <div
          className={`relative h-full transition-all duration-300 ${
            isEditorOpen ? "w-1/2" : "w-full"
          }`}
        >
          <GameScene
            onCamerasReady={setCameras}
            paused={gameState !== "playing"}
          />
          {cameras.length > 0 && canvasRef.current && (
            <PlayerHUDOverlay
              canvasElement={canvasRef.current}
              cameras={cameras}
            />
          )}
          {showPausedOverlay ? (
            <PausedOverlay
              roomId={roomId}
              joinQrValue={joinQrValue}
              connectionStatus={connectionStatus}
              lastError={lastError}
            />
          ) : null}
        </div>

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
