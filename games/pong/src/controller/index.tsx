/**
 * Controller surface for pong. Renders on each connected phone / tablet.
 *
 * Flow:
 *  1. `ControllerView` mounts the remote audio runtime (host-triggered sounds
 *     arrive through it) and delegates to `ControllerScreen`.
 *  2. `ControllerScreen` reads the networked `usePongStore` slice through
 *     `useTeamsSnapshot`. The store is shared with the host — state we see
 *     here is the host's authoritative truth, replicated.
 *  3. Controller-only state (the current movement direction, stored in a ref)
 *     is published to the host every ~16ms via `useControllerTick` +
 *     `useInputWriter`. The host reads it with `host.getInput(playerId)`.
 *  4. `useControllerConnectionNotice` converts the SDK connection status into
 *     a banner + a `controlsDisabled` flag that gates input + action buttons.
 *  5. Phase-specific panels (`LobbyPanel` / `PlayingControls` / `EndedPanel`)
 *     are picked by `matchPhase` and render the actual UI.
 *
 * This file orchestrates wiring only. No game rules, no scoring logic, no
 * bot AI — those all live on the host and replicate down through the store.
 */
import {
  ControllerRemoteAudioRuntime,
  useAirJamController,
  useControllerTick,
  useControllerToasts,
  useInputWriter,
} from "@air-jam/sdk";
import { ControllerPlayerNameField, SurfaceViewport } from "@air-jam/sdk/ui";
import { useEffect, useRef } from "react";
import { PONG_SOUND_MANIFEST } from "../game/sounds";
import { usePongStore } from "../game/stores";
import { useTeamsSnapshot } from "../game/use-teams-snapshot";
import { ControllerHeader } from "./components/controller-header";
import { EndedPanel } from "./components/ended-panel";
import { LobbyPanel } from "./components/lobby-panel";
import { PlayingControls } from "./components/playing-controls";
import { useControllerConnectionNotice } from "./use-controller-connection-notice";

/** Controller input tick rate — publish movement intent to the host at ~60Hz. */
const INPUT_TICK_INTERVAL_MS = 16;

export function ControllerView() {
  const controller = useAirJamController();

  return (
    <ControllerRemoteAudioRuntime
      manifest={PONG_SOUND_MANIFEST}
      enabled={controller.connectionStatus === "connected"}
    >
      <ControllerScreen controller={controller} />
    </ControllerRemoteAudioRuntime>
  );
}

function ControllerScreen({
  controller,
}: {
  controller: ReturnType<typeof useAirJamController>;
}) {
  const { latestToast } = useControllerToasts();
  const writeInput = useInputWriter();
  // Movement intent is a ref so onPointer events can update it without
  // triggering re-renders; the tick loop reads the latest value every frame.
  const directionRef = useRef(0);

  const actions = usePongStore.useActions();

  const {
    teamAssignments,
    botCounts,
    pointsToWin,
    matchPhase,
    matchSummary,
    team1Players,
    team2Players,
    teamCounts,
    readiness,
    readinessText,
  } = useTeamsSnapshot(controller.players, "controller");

  const myAssignment = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : undefined;
  const myTeam = myAssignment?.team ?? null;
  const myProfile = controller.selfPlayer;

  const { canSendSystemCommand, controlsDisabled, connectionNotice } =
    useControllerConnectionNotice(controller.connectionStatus);

  // Publish movement intent to the host while connected + playing.
  useControllerTick(
    () => {
      writeInput({
        direction: directionRef.current,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.runtimeState === "playing",
      intervalMs: INPUT_TICK_INTERVAL_MS,
    },
  );

  // Reset direction the instant controls go away so no stuck input leaks
  // through a disconnect / reconnect cycle.
  useEffect(() => {
    if (controlsDisabled) {
      directionRef.current = 0;
    }
  }, [controlsDisabled]);

  // Also release direction when the tab is backgrounded — pointerup events
  // don't always fire reliably on mobile when the browser loses focus.
  useEffect(() => {
    const releaseDirection = () => {
      directionRef.current = 0;
    };

    window.addEventListener("blur", releaseDirection);
    document.addEventListener("visibilitychange", releaseDirection);

    return () => {
      window.removeEventListener("blur", releaseDirection);
      document.removeEventListener("visibilitychange", releaseDirection);
    };
  }, []);

  return (
    <SurfaceViewport orientation="portrait" className="bg-zinc-950">
      <div className="pong-controller-shell pong-safe-screen flex h-full min-h-0 w-full flex-col text-white">
        <ControllerHeader
          roomId={controller.roomId}
          myProfile={myProfile}
          connectionStatus={controller.connectionStatus}
          matchPhase={matchPhase}
          runtimeState={controller.runtimeState}
          canSendSystemCommand={canSendSystemCommand}
          canStartMatch={readiness.canStart}
          onTogglePause={() =>
            controller.sendSystemCommand(
              controller.runtimeState === "playing" ? "pause" : "resume",
            )
          }
          onReturnToLobby={() => actions.returnToLobby()}
          onStartMatch={() => actions.startMatch()}
          onRestartMatch={() => actions.restartMatch()}
        />

        {matchPhase === "lobby" ? (
          <ControllerPlayerNameField
            className="px-3 pt-1 pb-2"
            labelClassName="text-[0.625rem] font-semibold tracking-[0.18em] text-zinc-400 uppercase"
            inputClassName="w-full rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-white/30 focus:ring-1 focus:ring-white/20"
          />
        ) : null}

        {connectionNotice ? (
          <div className="rounded-b-xl border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.12em] text-amber-100 uppercase">
            {connectionNotice}
          </div>
        ) : null}
        {latestToast ? (
          <div
            className="rounded-b-xl border-b px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase"
            style={{
              borderColor: `${latestToast.color ?? "#38bdf8"}55`,
              backgroundColor: `${latestToast.color ?? "#38bdf8"}1a`,
              color: latestToast.color ?? "#bae6fd",
            }}
          >
            {latestToast.message}
          </div>
        ) : null}

        {matchPhase === "lobby" ? (
          <LobbyPanel
            myTeam={myTeam}
            teamCounts={teamCounts}
            botCounts={botCounts}
            team1Players={team1Players}
            team2Players={team2Players}
            pointsToWin={pointsToWin}
            controlsDisabled={controlsDisabled}
            canStartMatch={readiness.canStart}
            readinessText={readinessText}
            onJoinTeam={(team) => actions.joinTeam({ team })}
            onSetBotCount={(team, count) =>
              actions.setBotCount({ team, count })
            }
            onSetPointsToWin={(nextPointsToWin) =>
              actions.setPointsToWin({ pointsToWin: nextPointsToWin })
            }
            onStartMatch={() => actions.startMatch()}
          />
        ) : matchPhase === "ended" ? (
          <EndedPanel
            matchSummary={matchSummary}
            runtimeState={controller.runtimeState}
            onBackToLobby={() => actions.returnToLobby()}
            onRestart={() => actions.restartMatch()}
          />
        ) : (
          <PlayingControls
            controlsDisabled={controlsDisabled}
            myTeam={myTeam}
            onDirectionChange={(direction) => {
              directionRef.current = direction;
            }}
          />
        )}
      </div>
    </SurfaceViewport>
  );
}
