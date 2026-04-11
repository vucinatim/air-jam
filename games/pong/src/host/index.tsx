import {
  AudioRuntime,
  useAirJamHost,
  useAudio,
  useHostRuntimeStateBridge,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  SurfaceViewport,
  useHostLobbyShell,
} from "@air-jam/sdk/ui";
import { useVisualHarnessBridge } from "@air-jam/visual-harness/runtime";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { pongVisualHarnessBridge } from "../../visual/contract";
import { getMatchReadiness } from "../game/domain/match-readiness";
import { getTeamCounts } from "../game/domain/team-slots";
import {
  createRuntimeState,
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  resetBall,
  stepGame,
} from "../game/engine";
import { gameInputSchema } from "../game/input";
import { PONG_SOUND_MANIFEST } from "../game/shared/sounds";
import { usePongStore } from "../game/stores";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { MatchOverlay } from "./components/match-overlay";
import { ScoreStrip } from "./components/score-strip";
import { usePongFeedback } from "./hooks/use-pong-feedback";

export function HostView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <HostScreen />
    </AudioRuntime>
  );
}

function HostScreen() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const audio = useAudio<keyof typeof PONG_SOUND_MANIFEST & string>();
  const { runtimeState, toggleRuntimeState } = host;
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

  const team1Players = useMemo(
    () =>
      host.players.filter(
        (player) => teamAssignments[player.id]?.team === "team1",
      ),
    [host.players, teamAssignments],
  );
  const team2Players = useMemo(
    () =>
      host.players.filter(
        (player) => teamAssignments[player.id]?.team === "team2",
      ),
    [host.players, teamAssignments],
  );
  const teamCounts = useMemo(
    () =>
      getTeamCounts([
        ...team1Players.map(() => ({ team: "team1" as const })),
        ...team2Players.map(() => ({ team: "team2" as const })),
      ]),
    [team1Players, team2Players],
  );
  const canStartMatch = useMemo(
    () => getMatchReadiness(teamCounts, botCounts).canStart,
    [botCounts, teamCounts],
  );
  const hostLobbyShell = useHostLobbyShell({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: () => actions.startMatch(),
  });
  const previewControllersEnabled = import.meta.env.DEV;
  useVisualHarnessBridge(pongVisualHarnessBridge, {
    host,
    matchPhase,
    runtimeState,
    actions,
  });

  const showPausedOverlay =
    matchPhase === "playing" && runtimeState !== "playing";

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  useHostRuntimeStateBridge({
    matchPhase,
    runtimeState,
    toggleRuntimeState,
    onEnterActivePhase: () => {
      setCountdown(3);
      Object.assign(runtimeStateRef.current, createRuntimeState());
    },
    onExitActivePhase: () => {
      setCountdown(null);
    },
    onPhaseTransition: ({ previousPhase, matchPhase: nextPhase }) => {
      if (previousPhase === "ended" && nextPhase === "lobby") {
        resetBall(runtimeStateRef.current);
      }
    },
  });

  useEffect(() => {
    if (countdown === null) return;
    if (runtimeState !== "playing" || matchPhase !== "playing") return;

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
  }, [countdown, runtimeState, matchPhase]);

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
        isPlaying: runtimeState === "playing" && matchPhase === "playing",
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
    runtimeState,
    host.getInput,
    host.players,
    matchPhase,
    triggerPaddleHitFeedback,
    triggerScoreFeedback,
    botCounts,
    teamAssignments,
  ]);

  let content: JSX.Element;

  if (matchPhase === "lobby") {
    content = (
      <LobbyScreen
        joinQrValue={hostLobbyShell.joinUrlValue}
        copiedJoinUrl={hostLobbyShell.copied}
        onCopyJoinUrl={hostLobbyShell.handleCopy}
        onOpenJoinUrl={hostLobbyShell.handleOpen}
        roomId={host.roomId}
        botCounts={botCounts}
        pointsToWin={pointsToWin}
        connectedPlayers={host.players}
        team1Players={team1Players}
        team2Players={team2Players}
        canStartMatch={canStartMatch}
        onStartMatch={hostLobbyShell.handleStart}
      />
    );
  } else if (matchPhase === "ended") {
    content = (
      <EndedScreen
        roomId={host.roomId}
        matchSummary={matchSummary}
        team1Players={team1Players}
        team2Players={team2Players}
        botCounts={botCounts}
      />
    );
  } else {
    content = (
      <div className="pong-app-shell h-full w-full text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 sm:px-6">
          <ScoreStrip
            team1Players={team1Players}
            team2Players={team2Players}
            botCounts={botCounts}
            pointsToWin={pointsToWin}
            scores={scores}
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-4 pt-28 pb-6 sm:px-6 sm:pt-32 sm:pb-8">
          <div className="pong-stage-frame flex max-h-full max-w-full items-center justify-center">
            <canvas
              ref={canvasRef}
              className="block max-h-full max-w-full rounded-[22px] border border-white/16 bg-black"
            />
          </div>
        </div>

        {showPausedOverlay ? (
          <MatchOverlay
            joinQrValue={hostLobbyShell.joinUrlValue}
            roomId={host.roomId}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-60">
        <HostMuteButton
          muted={audioMuted}
          onToggle={() => setAudioMuted((previous) => !previous)}
        />
      </div>
      <SurfaceViewport preset="host-standard" className="bg-[#02030a]">
        {content}
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        enabled={previewControllersEnabled}
        className="right-4 bottom-4 z-60 sm:right-6 sm:bottom-6"
      />
    </>
  );
}
