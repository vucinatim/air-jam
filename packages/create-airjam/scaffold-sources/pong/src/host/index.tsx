import {
  AudioRuntime,
  PlatformSettingsRuntime,
  useAirJamHost,
  useAudio,
  useHostGameStateBridge,
} from "@air-jam/sdk";
import { HostMuteButton } from "@air-jam/sdk/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { MatchOverlay } from "./components/match-overlay";
import { ScoreStrip } from "./components/score-strip";
import {
  createRuntimeState,
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  resetBall,
  stepGame,
} from "../game/engine";
import { usePongFeedback } from "./hooks/use-pong-feedback";
import { gameInputSchema } from "../game/input";
import { PONG_SOUND_MANIFEST } from "../game/shared/sounds";
import { usePongStore } from "../game/stores";

export function HostView() {
  return (
    <PlatformSettingsRuntime>
      <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
        <HostScreen />
      </AudioRuntime>
    </PlatformSettingsRuntime>
  );
}

function HostScreen() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const audio = useAudio<keyof typeof PONG_SOUND_MANIFEST & string>();
  const { gameState, toggleGameState } = host;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);

  const scores = usePongStore((state) => state.scores);
  const matchPhase = usePongStore((state) => state.matchPhase);
  const botCounts = usePongStore((state) => state.botCounts);
  const pointsToWin = usePongStore((state) => state.pointsToWin);
  const matchSummary = usePongStore((state) => state.matchSummary);
  const teamAssignments = usePongStore((state) => state.teamAssignments);
  const actions = usePongStore.useActions();
  const { triggerPaddleHitFeedback, triggerScoreFeedback } = usePongFeedback({
    matchPhase,
    matchSummaryWinner: matchSummary?.winner ?? null,
    matchSummary,
  });

  const runtimeStateRef = useRef(createRuntimeState());

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

  const team1Players = useMemo(
    () =>
      host.players.filter((player) => teamAssignments[player.id]?.team === "team1"),
    [host.players, teamAssignments],
  );
  const team2Players = useMemo(
    () =>
      host.players.filter((player) => teamAssignments[player.id]?.team === "team2"),
    [host.players, teamAssignments],
  );

  const showPausedOverlay = matchPhase === "playing" && gameState !== "playing";

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  useHostGameStateBridge({
    phase: matchPhase,
    playingPhase: "playing",
    gameState,
    toggleGameState,
    onEnterPlayingPhase: () => {
      setCountdown(3);
      Object.assign(runtimeStateRef.current, createRuntimeState());
    },
    onExitPlayingPhase: () => {
      setCountdown(null);
    },
    onPhaseTransition: ({ previousPhase, phase }) => {
      if (previousPhase === "ended" && phase === "lobby") {
        resetBall(runtimeStateRef.current);
      }
    },
  });

  useEffect(() => {
    if (countdown === null) return;
    if (gameState !== "playing" || matchPhase !== "playing") return;

    if (countdown === 0) {
      resetBall(runtimeStateRef.current);
      setTimeout(() => {
        setCountdown(null);
      }, 0);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((previous) => (previous === null ? null : previous - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, gameState, matchPhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = FIELD_WIDTH * dpr;
    canvas.height = FIELD_HEIGHT * dpr;
    canvas.style.width = `${FIELD_WIDTH}px`;
    canvas.style.height = `${FIELD_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    let animationFrameId: number;

    const loop = () => {
      stepGame({
        state: runtimeStateRef.current,
        players: host.players,
        teamAssignments,
        getInput: host.getInput,
        isPlaying: gameState === "playing" && matchPhase === "playing",
        countdown,
        botCounts,
        onPaddleHit: (event) => {
          triggerPaddleHitFeedback(event);
        },
        onScore: (team) => {
          triggerScoreFeedback();
          actions.scorePoint({ team });
          setCountdown(3);
        },
      });

      drawFrame({
        ctx,
        state: runtimeStateRef.current,
        players: host.players,
        teamAssignments,
        countdown,
        botCounts,
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    actions,
    countdown,
    gameState,
    host.getInput,
    host.players,
    matchPhase,
    triggerPaddleHitFeedback,
    triggerScoreFeedback,
    botCounts,
    teamAssignments,
  ]);

  if (matchPhase === "lobby") {
    return (
      <>
        <div className="fixed right-4 top-4 z-[60]">
          <HostMuteButton
            muted={audioMuted}
            onToggle={() => setAudioMuted((previous) => !previous)}
          />
        </div>
        <LobbyScreen
          joinQrValue={joinQrValue}
          roomId={host.roomId}
          botCounts={botCounts}
          pointsToWin={pointsToWin}
          connectedPlayers={host.players}
          team1Players={team1Players}
          team2Players={team2Players}
        />
      </>
    );
  }

  if (matchPhase === "ended") {
    return (
      <>
        <div className="fixed right-4 top-4 z-[60]">
          <HostMuteButton
            muted={audioMuted}
            onToggle={() => setAudioMuted((previous) => !previous)}
          />
        </div>
        <EndedScreen
          roomId={host.roomId}
          matchSummary={matchSummary}
          team1Players={team1Players}
          team2Players={team2Players}
          botCounts={botCounts}
        />
      </>
    );
  }

  return (
    <div className="pong-app-shell h-screen w-screen text-white">
      <div className="fixed right-4 top-4 z-[60]">
        <HostMuteButton
          muted={audioMuted}
          onToggle={() => setAudioMuted((previous) => !previous)}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 sm:px-6">
        <ScoreStrip
          team1Players={team1Players}
          team2Players={team2Players}
          botCounts={botCounts}
          pointsToWin={pointsToWin}
          scores={scores}
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4 pb-6 pt-28 sm:px-6 sm:pb-8 sm:pt-32">
        <div className="pong-stage-frame flex max-h-full max-w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            className="block max-h-[calc(100vh-12rem)] max-w-[calc(100vw-3rem)] rounded-[22px] border border-white/16 bg-black"
          />
        </div>
      </div>

      {showPausedOverlay ? (
        <MatchOverlay
          joinQrValue={joinQrValue}
          roomId={host.roomId}
        />
      ) : null}
    </div>
  );
}
