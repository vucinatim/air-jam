/**
 * Host surface for the-office.
 *
 * Office-themed co-op: each controller adopts a "player" persona with its
 * own capabilities, and they cooperate on pending tasks that appear in
 * `TaskSidebar`. `GameCanvas` renders the 2D office floor; the rest of the
 * host is just chrome over the networked `useSpaceStore` state plus the
 * match-clock / pending-task hooks in `../hooks/use-game-state`.
 */
import { AudioRuntime, useAirJamHost, useHostTick } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  JoinQrOverlay,
  JoinUrlControls,
  LifecycleActionGroup,
  PlayerAvatar,
  SurfaceViewport,
  useHostJoinControls,
} from "@air-jam/sdk/ui";
import { VisualHarnessRuntime } from "@air-jam/visual-harness/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { theOfficeVisualHarnessBridge } from "../../visual/contract";
import { GameCanvas } from "../components/game-canvas";
import { GameOverOverlay } from "../components/game-over-overlay";
import { TaskSidebar } from "../components/task-sidebar";
import { gameInputSchema } from "../game/input";
import { OFFICE_SOUND_MANIFEST } from "../game/sounds";
import {
  useOfficeFinalTotalMoney,
  useOfficeGameOver,
  useOfficeMatchPhase,
  useOfficeSelectedPlayerCount,
  useSpaceStore,
} from "../game/stores";
import {
  useOfficeActiveMatchClock,
  useOfficeGameRuntime,
  useOfficePendingTasks,
} from "../hooks/use-game-state";
import { getPlayerById, getPlayerCapabilityHighlights } from "../players";

type OfficeHostApi = ReturnType<typeof useAirJamHost<typeof gameInputSchema>>;

const OFFICE_SIMULATION_STEP_MS = 1000 / 60;

export function HostView() {
  return (
    <AudioRuntime manifest={OFFICE_SOUND_MANIFEST}>
      <OfficeHostScreen />
    </AudioRuntime>
  );
}

function OfficeHostScreen() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const { connectionStatus } = host;
  const [audioMuted, setAudioMuted] = useState(false);
  const playerIds = useMemo(
    () => host.players.map((player) => player.id),
    [host.players],
  );
  const matchPhase = useOfficeMatchPhase();
  const selectedCount = useOfficeSelectedPlayerCount(playerIds);
  const storeActions = useSpaceStore.useActions();

  const canStartMatch =
    matchPhase === "lobby" &&
    selectedCount > 0 &&
    selectedCount === playerIds.length &&
    connectionStatus === "connected";
  const hostJoinControls = useHostJoinControls({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: () => storeActions.startMatch(),
  });
  const {
    advanceElapsedMs,
    elapsedMsRef: matchElapsedMsRef,
    timeRemainingMs,
  } = useOfficeActiveMatchClock();

  const handleRestart = () => {
    storeActions.returnToLobby();
  };

  const handleStart = () => {
    if (!canStartMatch) {
      return;
    }
    storeActions.startMatch();
  };

  return (
    <>
      <VisualHarnessRuntime
        bridge={theOfficeVisualHarnessBridge}
        context={{
          host,
          matchPhase,
          runtimeState: host.runtimeState,
          storeActions,
        }}
      />
      <SurfaceViewport className="bg-[#fdf6e3]">
        <div className="relative flex h-full w-full flex-col overflow-hidden p-2">
          <OfficeHostTopHud timeRemainingMs={timeRemainingMs} />
          <OfficeHostGameplaySurface
            players={host.players}
            getInput={host.getInput}
            runtimeState={host.runtimeState}
            muted={audioMuted}
            connectedPlayerIds={playerIds}
            matchElapsedMsRef={matchElapsedMsRef}
            advanceMatchClock={advanceElapsedMs}
          />

          <div className="mt-4 flex gap-4">
            {host.players.slice(0, 2).map((player) => (
              <PlayerAvatar key={player.id} player={player} size="sm" />
            ))}
          </div>

          {matchPhase === "lobby" ? (
            <OfficeHostLobbyOverlay
              host={host}
              playerCount={playerIds.length}
              selectedCount={selectedCount}
              hostJoinControls={hostJoinControls}
              onStart={handleStart}
              canStartMatch={canStartMatch}
            />
          ) : null}

          {matchPhase === "ended" ? (
            <OfficeHostEndedOverlay
              players={host.players}
              onRestart={handleRestart}
            />
          ) : null}

          {matchPhase === "playing" && host.runtimeState !== "playing" ? (
            <OfficeHostPausedOverlay />
          ) : null}
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        dockAccessory={
          <HostMuteButton
            muted={audioMuted}
            onToggle={() => setAudioMuted((previous) => !previous)}
          />
        }
      />
    </>
  );
}

function OfficeHostTopHud({ timeRemainingMs }: { timeRemainingMs: number }) {
  const finalTotalMoney = useOfficeFinalTotalMoney();

  return (
    <div className="mb-4 flex w-full items-center justify-center gap-8 text-center">
      <span className="text-foreground text-3xl font-bold">
        EUR {finalTotalMoney}
      </span>
      <span className="text-foreground inline-block w-20 text-center text-2xl font-bold">
        {Math.floor(timeRemainingMs / 60000)}:
        {String(Math.floor((timeRemainingMs % 60000) / 1000)).padStart(2, "0")}
      </span>
    </div>
  );
}

function OfficeHostGameplaySurface({
  players,
  getInput,
  runtimeState,
  muted,
  connectedPlayerIds,
  matchElapsedMsRef,
  advanceMatchClock,
}: {
  players: OfficeHostApi["players"];
  getInput: OfficeHostApi["getInput"];
  runtimeState: OfficeHostApi["runtimeState"];
  muted: boolean;
  connectedPlayerIds: string[];
  matchElapsedMsRef: React.MutableRefObject<number>;
  advanceMatchClock: (deltaMs: number) => number;
}) {
  const {
    gameStateRef,
    taskManagerRef,
    pendingTasksRef,
    breakroomActivitiesRef,
    playerImagesRef,
    locationImagesRef,
    loadPlayerImages,
    loadLocationImages,
    updateGame,
  } = useOfficeGameRuntime({
    muted,
    connectedPlayerIds,
  });
  const matchPhase = useOfficeMatchPhase();
  const gameOver = useOfficeGameOver();
  const pendingTasks = useOfficePendingTasks(pendingTasksRef);
  const imagesPreloadedRef = useRef(false);
  const renderFrameRef = useRef<(() => void) | null>(null);

  const getInputForPlayer = useCallback(
    (playerId: string) => getInput(playerId) ?? null,
    [getInput],
  );
  const gameStatePlaying =
    matchPhase === "playing" && runtimeState === "playing";

  useHostTick({
    enabled: matchPhase !== "lobby",
    mode: "fixed",
    intervalMs: OFFICE_SIMULATION_STEP_MS,
    onTick: ({ deltaMs }) => {
      if (!gameStatePlaying) {
        return;
      }

      const matchElapsedMs = advanceMatchClock(deltaMs);
      updateGame(matchElapsedMs, players, getInputForPlayer, true);
    },
    onFrame: () => {
      renderFrameRef.current?.();
    },
  });

  useEffect(() => {
    if (imagesPreloadedRef.current) {
      return;
    }

    imagesPreloadedRef.current = true;
    void loadPlayerImages();
    void loadLocationImages();
  }, [loadLocationImages, loadPlayerImages]);

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <TaskSidebar pendingTasks={pendingTasks} />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <GameCanvas
          gameStateRef={gameStateRef}
          taskManagerRef={taskManagerRef}
          breakroomActivitiesRef={breakroomActivitiesRef}
          playerImagesRef={playerImagesRef}
          locationImagesRef={locationImagesRef}
          matchElapsedMsRef={matchElapsedMsRef}
          renderFrameRef={renderFrameRef}
          players={players}
        />

        {matchPhase === "playing" && gameOver ? (
          <OfficePlayingGameOverOverlay />
        ) : null}
      </div>
    </div>
  );
}

function OfficePlayingGameOverOverlay() {
  const finalTotalMoney = useOfficeFinalTotalMoney();
  const storeActions = useSpaceStore.useActions();

  return (
    <GameOverOverlay
      totalMoney={finalTotalMoney}
      onRestart={() => storeActions.returnToLobby()}
    />
  );
}

function OfficeHostLobbyOverlay({
  host,
  playerCount,
  selectedCount,
  hostJoinControls,
  onStart,
  canStartMatch,
}: {
  host: OfficeHostApi;
  playerCount: number;
  selectedCount: number;
  hostJoinControls: ReturnType<typeof useHostJoinControls>;
  onStart: () => void;
  canStartMatch: boolean;
}) {
  const playerAssignments = useSpaceStore((state) => state.playerAssignments);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/70 p-4">
      <div className="w-full max-w-2xl border border-[#fef3c7] bg-[#fef3c7] p-6 text-[#5c4a2e] shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
              Room
            </p>
            <p className="text-xl font-bold">{host.roomId ?? "----"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
              Picked
            </p>
            <p className="text-xl font-bold">
              {selectedCount}/{playerCount}
            </p>
          </div>
        </div>

        <div className="mb-4 w-full">
          <JoinUrlControls
            value={hostJoinControls.joinUrlValue}
            label={
              <span className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
                Controller link
              </span>
            }
            copied={hostJoinControls.copied}
            onCopy={hostJoinControls.handleCopy}
            onOpen={hostJoinControls.handleOpen}
            qrVisible={hostJoinControls.joinQrVisible}
            onToggleQr={hostJoinControls.toggleJoinQr}
            inputClassName="border-[#e5d4ab] bg-[#fff6d8] text-[#5c4a2e] placeholder:text-[#8b6914]/70"
            buttonClassName="rounded-none border-[#8b6914]/25 bg-[#8b6914] text-[#fdf6e3] hover:bg-[#7a5b11]"
          />
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto border border-[#e5d4ab] bg-[#fff6d8] p-3">
          {host.players.length === 0 ? (
            <p className="text-sm text-[#6b7280]">
              Waiting for controllers to join…
            </p>
          ) : (
            <ul className="space-y-2">
              {host.players.map((player) => {
                const selectedCharacterId = playerAssignments[player.id];
                const selectedCharacter = selectedCharacterId
                  ? getPlayerById(selectedCharacterId)
                  : null;
                const highlights = selectedCharacterId
                  ? getPlayerCapabilityHighlights(selectedCharacterId, 2)
                  : [];

                return (
                  <li
                    key={player.id}
                    className="border-b border-[#e5d4ab] pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{player.label}</p>
                        <p className="text-xs text-[#8b6914]">
                          {selectedCharacter
                            ? selectedCharacter.name
                            : "No character selected"}
                        </p>
                      </div>
                      <span className="font-semibold">
                        {selectedCharacter ? "Selected" : "Unselected"}
                      </span>
                    </div>
                    {selectedCharacter ? (
                      <div className="mt-2 flex items-start gap-2">
                        <img
                          src={selectedCharacter.image}
                          alt={selectedCharacter.name}
                          className="h-10 w-10 rounded object-cover object-top"
                        />
                        <div className="space-y-1 text-[11px] text-[#5c4a2e]">
                          {highlights.map((highlight) => (
                            <p
                              key={`${selectedCharacter.id}:${highlight.taskId}`}
                            >
                              {highlight.label}: {highlight.level}/5 •{" "}
                              {(highlight.durationMs / 1000).toFixed(0)}s
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <LifecycleActionGroup
          phase="lobby"
          canInteract={canStartMatch}
          onStart={onStart}
          startLabel="Start Match"
          className="justify-center"
          buttonClassName="rounded-none border-[#8b6914]/25 bg-[#8b6914] px-5 text-[#fdf6e3] hover:bg-[#7a5b11]"
        />
        <JoinQrOverlay
          open={hostJoinControls.joinQrVisible}
          value={hostJoinControls.joinUrlValue}
          roomId={host.roomId}
          onClose={hostJoinControls.hideJoinQr}
          description="Scan with your phone to join The Office as a controller."
        />
      </div>
    </div>
  );
}

function OfficeHostEndedOverlay({
  players,
  onRestart,
}: {
  players: OfficeHostApi["players"];
  onRestart: () => void;
}) {
  const money = useSpaceStore((state) => state.money);
  const finalTotalMoney = useOfficeFinalTotalMoney();
  const finalEarnings = useMemo(
    () =>
      players
        .map((player) => ({
          id: player.id,
          label: player.label,
          earnings: money[player.id] ?? 0,
        }))
        .sort((left, right) => right.earnings - left.earnings),
    [money, players],
  );

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/70 p-4">
      <div className="w-full max-w-2xl border border-[#fef3c7] bg-[#fef3c7] p-6 text-[#5c4a2e] shadow-2xl">
        <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
          Shift Ended
        </p>
        <p className="mt-2 text-3xl font-bold">Final Earnings</p>
        <p className="mt-1 text-2xl font-bold text-[#8b6914]">
          EUR {finalTotalMoney}
        </p>

        <div className="mt-4 max-h-64 overflow-y-auto border border-[#e5d4ab] bg-[#fff6d8] p-3">
          {finalEarnings.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No connected players.</p>
          ) : (
            <ul className="space-y-2">
              {finalEarnings.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between border-b border-[#e5d4ab] pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-semibold">
                    {index + 1}. {entry.label}
                  </span>
                  <span className="font-bold text-[#8b6914]">
                    EUR {entry.earnings}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="mt-4 w-full rounded-none bg-[#8b6914] px-4 py-3 text-lg font-bold tracking-wide text-[#fdf6e3] uppercase transition hover:bg-[#7a5b11]"
        >
          Back To Lobby
        </button>
      </div>
    </div>
  );
}

function OfficeHostPausedOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/45 p-4">
      <div className="w-full max-w-sm border border-[#fef3c7] bg-[#fef3c7] p-4 text-center text-[#5c4a2e] shadow-xl">
        <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
          Match Paused
        </p>
        <p className="mt-2 text-sm text-[#6b7280]">
          Waiting for runtime reconnect...
        </p>
      </div>
    </div>
  );
}
