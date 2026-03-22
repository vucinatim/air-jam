import { useAirJamHost, useHostGameStateBridge } from "@air-jam/sdk";
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
} from "./game-engine";
import { usePongFeedback } from "./hooks/use-pong-feedback";
import { usePongStore } from "../store";
import { gameInputSchema } from "../input";

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const { gameState, toggleGameState } = host;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const scores = usePongStore((state) => state.scores);
  const matchPhase = usePongStore((state) => state.matchPhase);
  const botTeam = usePongStore((state) => state.botTeam);
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
        botTeam,
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
        botTeam,
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
    botTeam,
    teamAssignments,
  ]);

  if (matchPhase === "lobby") {
    return (
      <LobbyScreen
        joinQrValue={joinQrValue}
        roomId={host.roomId}
        botTeam={botTeam}
        pointsToWin={pointsToWin}
        connectedPlayers={host.players}
        team1Players={team1Players}
        team2Players={team2Players}
      />
    );
  }

  if (matchPhase === "ended") {
    return (
      <EndedScreen
        roomId={host.roomId}
        matchSummary={matchSummary}
        team1Players={team1Players}
        team2Players={team2Players}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-900 p-4">
      <ScoreStrip
        team1Players={team1Players}
        team2Players={team2Players}
        botTeam={botTeam}
        pointsToWin={pointsToWin}
        scores={scores}
      />

      <div className="relative">
        <canvas ref={canvasRef} className="rounded-lg border-2 border-white" />
        {showPausedOverlay ? (
          <MatchOverlay
            joinQrValue={joinQrValue}
            roomId={host.roomId}
          />
        ) : null}
      </div>
    </div>
  );
}
