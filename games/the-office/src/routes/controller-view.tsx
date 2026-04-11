import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import {
  Button,
  ControllerPrimaryAction,
  LifecycleActionGroup,
  RuntimeShellHeader,
  SurfaceViewport,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useSpaceStore } from "../game/stores";
import {
  getPlayerById,
  getPlayerCapabilityHighlights,
  PLAYERS,
} from "../players";

export function ControllerView() {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const movementRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);

  const money = useSpaceStore((state) => state.money);
  const totalMoneyPenalty = useSpaceStore((state) => state.totalMoneyPenalty);
  const matchPhase = useSpaceStore((state) => state.matchPhase);
  const readyByPlayerId = useSpaceStore((state) => state.readyByPlayerId);
  const playerAssignments = useSpaceStore((state) => state.playerAssignments);
  const busyPlayers = useSpaceStore((state) => state.busyPlayers);
  const playerStats = useSpaceStore((state) => state.playerStats);
  const taskProgress = useSpaceStore((state) => state.taskProgress);
  const gameOver = useSpaceStore((state) => state.gameOver);
  const actions = useSpaceStore.useActions();

  const myPlayerId = controller.controllerId
    ? playerAssignments[controller.controllerId]
    : null;
  const myPlayer = myPlayerId ? getPlayerById(myPlayerId) : null;
  const myTaskName = controller.controllerId
    ? busyPlayers[controller.controllerId]
    : null;
  const isBusy = Boolean(myTaskName);
  const myStats = controller.controllerId
    ? playerStats[controller.controllerId]
    : null;
  const myProgress = controller.controllerId
    ? taskProgress[controller.controllerId] || 0
    : 0;
  const isReady = controller.controllerId
    ? (readyByPlayerId[controller.controllerId] ?? false)
    : false;
  const selectedPlayerCount = useMemo(
    () => Object.keys(playerAssignments).length,
    [playerAssignments],
  );
  const characterOwnerById = useMemo(() => {
    const ownerByCharacterId = new Map<string, string>();
    Object.entries(playerAssignments).forEach(([controllerId, playerId]) => {
      ownerByCharacterId.set(playerId, controllerId);
    });
    return ownerByCharacterId;
  }, [playerAssignments]);
  const readyCount = useMemo(
    () =>
      Object.keys(playerAssignments).filter(
        (playerId) => readyByPlayerId[playerId] ?? false,
      ).length,
    [playerAssignments, readyByPlayerId],
  );
  const hasCharacterSelection = Boolean(myPlayerId);
  const canToggleReady =
    controller.connectionStatus === "connected" &&
    Boolean(controller.controllerId) &&
    hasCharacterSelection;
  const canStartMatch =
    controller.connectionStatus === "connected" &&
    selectedPlayerCount > 0 &&
    readyCount === selectedPlayerCount;
  const shellStatus = useControllerShellStatus({
    roomId: controller.roomId,
    connectionStatus: controller.connectionStatus,
    playerLabel: myPlayer?.name ?? null,
    roomFallback: "Connecting...",
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canSendSystemCommand: controller.connectionStatus === "connected",
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onTogglePause: () => controller.sendSystemCommand("toggle_pause"),
    onBackToLobby: () => actions.setMatchPhase({ phase: "lobby" }),
    onRestart: () => actions.setMatchPhase({ phase: "playing" }),
  });
  const showLobbyView = matchPhase === "lobby";
  const showEndedView = matchPhase === "ended";
  const showGameplayView =
    matchPhase === "playing" && controller.runtimeState === "playing";
  const showPausedView = matchPhase === "playing" && !showGameplayView;
  const desiredOrientation =
    showLobbyView || showEndedView ? "portrait" : "landscape";

  useControllerTick(
    () => {
      writeInput({
        movementX: isBusy ? 0 : movementRef.current.x,
        movementY: isBusy ? 0 : movementRef.current.y,
        action: actionRef.current,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        matchPhase === "playing" &&
        controller.runtimeState === "playing",
      intervalMs: 16,
    },
  );

  useEffect(() => {
    const releaseControls = () => {
      movementRef.current = { x: 0, y: 0 };
      actionRef.current = false;
    };

    window.addEventListener("blur", releaseControls);
    document.addEventListener("visibilitychange", releaseControls);

    return () => {
      window.removeEventListener("blur", releaseControls);
      document.removeEventListener("visibilitychange", releaseControls);
    };
  }, []);

  const handleMove = (x: number, y: number) => {
    movementRef.current = { x, y };
  };

  const handleAction = (pressed: boolean) => {
    actionRef.current = pressed;
  };

  const totalMoney = Object.values(money).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const finalTotalMoney = totalMoney - totalMoneyPenalty;
  const isDead = myStats ? !myStats.alive : false;
  const energyValue = myStats?.energy ?? 0;
  const boredomValue = myStats?.boredom ?? 0;
  const lobbyPrimaryHelper = canStartMatch
    ? "Everyone is ready."
    : !hasCharacterSelection
      ? "Pick a coworker, then ready up."
      : `${readyCount}/${selectedPlayerCount} ready.`;

  return (
    <div className="controller-view-shell">
      <SurfaceViewport
        orientation={desiredOrientation}
        preset="controller-phone"
      >
        <div className="flex h-full w-full flex-col gap-3 bg-[linear-gradient(180deg,#fbf4d9_0%,#f0e3bb_100%)] p-3 text-[#5c4a2e]">
          <RuntimeShellHeader
            connectionStatus={controller.connectionStatus}
            leftSlot={
              <div className="flex min-w-0 items-center gap-3">
                {myPlayer ? (
                  <img
                    src={myPlayer.image}
                    alt={myPlayer.name}
                    className="h-10 w-10 rounded-full border border-[#e5d4ab] object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5d4ab] bg-[#fff6d8] text-[0.6875rem] font-bold text-[#5c4a2e]">
                    {shellStatus.identityInitial}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#5c4a2e]">
                    {shellStatus.displayName}
                  </p>
                  <p className="text-[0.625rem] tracking-[0.16em] text-[#8b6914] uppercase sm:text-[0.6875rem]">
                    {shellStatus.roomLine}
                  </p>
                </div>
              </div>
            }
            rightSlot={
              showLobbyView ? null : (
                <LifecycleActionGroup
                  phase={matchPhase}
                  runtimeState={controller.runtimeState}
                  canInteract={lifecyclePermissions.canInteractForPhase}
                  onTogglePause={lifecycleIntents.onTogglePause}
                  onBackToLobby={lifecycleIntents.onBackToLobby}
                  onRestart={lifecycleIntents.onRestart}
                  presentation="icon"
                  visibleKinds={
                    matchPhase === "playing"
                      ? ["pause-toggle", "back-to-lobby"]
                      : ["restart", "back-to-lobby"]
                  }
                  buttonClassName="border-[#8b6914]/25 bg-[#8b6914]/10 text-[#7a5b11] hover:bg-[#8b6914]/18"
                />
              )
            }
            className="border-[#e5d4ab] bg-[#fef3c7]/90"
          />
          {showLobbyView ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[28px] border border-[#e5d4ab] bg-[#fff6d8] p-3 shadow-md">
                <div className="grid grid-cols-2 gap-2">
                  {PLAYERS.map((playerOption) => {
                    const ownerControllerId = characterOwnerById.get(
                      playerOption.id,
                    );
                    const selectedByMe = myPlayerId === playerOption.id;
                    const takenByOtherController =
                      ownerControllerId !== undefined &&
                      ownerControllerId !== controller.controllerId;
                    const highlights = getPlayerCapabilityHighlights(
                      playerOption.id,
                      2,
                    );

                    return (
                      <button
                        key={playerOption.id}
                        type="button"
                        disabled={takenByOtherController}
                        onClick={() => {
                          if (takenByOtherController) return;
                          actions.selectCharacter({
                            playerId: playerOption.id,
                          });
                        }}
                        className={`rounded border-2 bg-[#fef3c7] p-2 text-left shadow-sm transition ${
                          selectedByMe ? "border-[#8b6914]" : "border-[#e5d4ab]"
                        } ${takenByOtherController ? "opacity-45" : "active:scale-[0.98]"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <img
                            src={playerOption.image}
                            alt={playerOption.name}
                            className={`h-12 w-12 rounded object-cover ${
                              takenByOtherController ? "grayscale" : ""
                            }`}
                          />
                          <div>
                            <p className="text-sm font-bold text-[#5c4a2e]">
                              {playerOption.name}
                            </p>
                            <p className="text-[10px] tracking-[0.12em] text-[#8b6914] uppercase">
                              {takenByOtherController
                                ? "Taken"
                                : selectedByMe
                                  ? "Selected"
                                  : "Available"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {highlights.map((highlight) => (
                            <div
                              key={`${playerOption.id}:${highlight.taskId}`}
                              className="flex items-center justify-between text-[10px] text-[#5c4a2e]"
                            >
                              <span>{highlight.label}</span>
                              <span className="font-semibold">
                                {highlight.level}/5 •{" "}
                                {(highlight.durationMs / 1000).toFixed(0)}s
                              </span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-[#5c4a2e]">
                  {hasCharacterSelection
                    ? isReady
                      ? `${myPlayer?.name ?? "Worker"} is ready`
                      : `${myPlayer?.name ?? "Worker"} not ready`
                    : "Pick a character first"}
                </span>
                <Button
                  type="button"
                  disabled={!canToggleReady}
                  onClick={() => {
                    if (!canToggleReady) return;
                    actions.setReady({ ready: !isReady });
                  }}
                  className="h-10 rounded-full border-[#8b6914]/30 bg-[#8b6914] px-4 text-[10px] font-black tracking-[0.16em] text-[#fdf6e3] uppercase hover:bg-[#7a5b11] disabled:bg-[#c7b384] disabled:text-[#fff8df]"
                >
                  {isReady ? "Unready" : "Ready"}
                </Button>
              </div>

              <ControllerPrimaryAction
                label="Start Match"
                helper={lobbyPrimaryHelper}
                disabled={!canStartMatch}
                onPress={() => actions.setMatchPhase({ phase: "playing" })}
                icon={<BriefcaseBusiness className="h-6 w-6" />}
                buttonClassName="border-[#8b6914]/30 bg-[#8b6914] text-[#fdf6e3] hover:bg-[#7a5b11] disabled:bg-[#c7b384] disabled:text-[#fff8df]"
              />
            </div>
          ) : null}

          {showPausedView ? (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#fef3c7] p-4 shadow-md">
              <div className="max-w-sm text-center">
                <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
                  Match Paused
                </p>
                <p className="mt-2 text-sm text-[#6b7280]">
                  Waiting for runtime sync...
                </p>
              </div>
            </div>
          ) : null}

          {showEndedView ? (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#fef3c7] p-4 shadow-md">
              <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[28px] border border-[#e5d4ab] bg-[#fff8df] px-5 py-6 text-center shadow-sm">
                <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
                  Shift Ended
                </p>
                <p className="mt-2 text-2xl font-bold text-[#5c4a2e]">
                  Final Earnings
                </p>
                <p className="mt-2 text-3xl font-black text-[#8b6914]">
                  EUR {finalTotalMoney}
                </p>
                <p className="text-sm text-[#6b7280]">
                  Use the shell actions above to restart or return to the lobby.
                </p>
              </div>
            </div>
          ) : null}

          {showGameplayView ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="rounded-[28px] border border-[#d8c58a] bg-[#fff8e1] px-4 py-3 shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {isDead && myPlayer?.image ? (
                        <img
                          src={myPlayer.image}
                          alt={myPlayer.name}
                          className="h-8 w-8 rounded-full object-cover grayscale"
                        />
                      ) : myPlayer?.image ? (
                        <img
                          src={myPlayer.image}
                          alt={myPlayer.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7e7b1] text-lg font-bold text-[#5c4a2e]">
                          {myPlayer?.name?.charAt(0) || "?"}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-[#5c4a2e]">
                          {isDead ? "Mrtvec" : myPlayer?.name || "Povezujem..."}
                        </p>
                        <p className="text-[10px] tracking-[0.16em] text-[#8b6914] uppercase">
                          {controller.roomId ?? "Connecting..."}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xl font-bold text-[#8b6914]">
                      {totalMoney} EUR
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-[#d8c58a] bg-[#fff8e1] px-4 py-3 shadow-sm">
                    <p className="text-[10px] tracking-[0.18em] text-[#8b6914] uppercase">
                      Energija
                    </p>
                    <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#eadcbc]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          energyValue > 30 ? "bg-[#d46060]" : "bg-[#a03030]"
                        }`}
                        style={{ width: `${energyValue}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-[#d8c58a] bg-[#fff8e1] px-4 py-3 shadow-sm">
                    <p className="text-[10px] tracking-[0.18em] text-[#8b6914] uppercase">
                      Sreča
                    </p>
                    <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#eadcbc]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          boredomValue > 30 ? "bg-[#5b9bd5]" : "bg-[#3a7bb5]"
                        }`}
                        style={{ width: `${boredomValue}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isBusy ? (
                  <div className="rounded-[24px] border border-[#d8c58a] bg-[#fff8e1] px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] tracking-[0.18em] text-[#8b6914] uppercase">
                        Task
                      </div>
                      <div className="text-sm font-semibold text-[#5c4a2e]">
                        {myTaskName}
                      </div>
                    </div>
                    <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#eadcbc]">
                      <div
                        className="h-full rounded-full bg-[#6aaa64] transition-all duration-100"
                        style={{ width: `${myProgress * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {gameOver ? (
                  <div className="flex flex-1 items-center justify-center rounded-[28px] border border-[#d8c58a] bg-[#fff8df] p-5 text-center shadow-md">
                    <div className="max-w-sm">
                      <p className="text-xs tracking-[0.22em] text-[#8b6914] uppercase">
                        Konec igre
                      </p>
                      <p className="mt-2 text-2xl font-bold text-[#c06030]">
                        Vsi igralci so umrli
                      </p>
                      <p className="mt-2 text-base text-[#5c4a2e]">
                        Skupaj zbrano: {totalMoney} EUR
                      </p>
                    </div>
                  </div>
                ) : isDead ? (
                  <div className="flex flex-1 items-center justify-center rounded-[28px] border border-[#d8c58a] bg-[#fff8df] p-5 text-center shadow-md">
                    <div className="max-w-sm">
                      <p className="text-xs tracking-[0.22em] text-[#8b6914] uppercase">
                        Ste mrtvi
                      </p>
                      <p className="mt-2 text-xl font-bold text-[#5c4a2e]">
                        Opazujete iz onstranstva
                      </p>
                      <p className="mt-2 text-sm text-[#6b7280]">
                        Vaš del igre je končan. Počakajte na naslednji krog.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {!gameOver && !isDead ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-[28px] border border-[#d8c58a] bg-[#fff8df] p-4 shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs tracking-[0.18em] text-[#8b6914] uppercase">
                      Controls
                    </p>
                    <p className="text-xs text-[#6b7280]">
                      Hold to work. Use the D-pad to move.
                    </p>
                  </div>

                  <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <button
                      type="button"
                      className="flex min-h-36 items-center justify-center rounded-[26px] bg-[#fff1bd] px-5 text-3xl font-black text-[#5c4a2e] shadow-lg transition-transform select-none active:scale-[0.98]"
                      onTouchStart={() => handleAction(true)}
                      onTouchEnd={() => handleAction(false)}
                      onTouchCancel={() => handleAction(false)}
                      onMouseDown={() => handleAction(true)}
                      onMouseUp={() => handleAction(false)}
                      onMouseLeave={() => handleAction(false)}
                    >
                      DELAJ
                    </button>

                    <div className="grid w-full max-w-48 grid-cols-3 grid-rows-3 gap-2 self-center justify-self-center">
                      <div />
                      <button
                        type="button"
                        className="flex aspect-square items-center justify-center rounded-[20px] border border-[#d8c58a] bg-[#fff6d8] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                        onTouchStart={() => handleMove(0, -1)}
                        onTouchEnd={() => handleMove(0, 0)}
                        onTouchCancel={() => handleMove(0, 0)}
                        onMouseDown={() => handleMove(0, -1)}
                        onMouseUp={() => handleMove(0, 0)}
                        onMouseLeave={() => handleMove(0, 0)}
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-7 w-7" />
                      </button>
                      <div />
                      <button
                        type="button"
                        className="flex aspect-square items-center justify-center rounded-[20px] border border-[#d8c58a] bg-[#fff6d8] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                        onTouchStart={() => handleMove(-1, 0)}
                        onTouchEnd={() => handleMove(0, 0)}
                        onTouchCancel={() => handleMove(0, 0)}
                        onMouseDown={() => handleMove(-1, 0)}
                        onMouseUp={() => handleMove(0, 0)}
                        onMouseLeave={() => handleMove(0, 0)}
                        aria-label="Move left"
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </button>
                      <button
                        type="button"
                        className="flex aspect-square items-center justify-center rounded-[20px] border border-[#d8c58a] bg-[#fff6d8] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                        onTouchStart={() => handleMove(0, 1)}
                        onTouchEnd={() => handleMove(0, 0)}
                        onTouchCancel={() => handleMove(0, 0)}
                        onMouseDown={() => handleMove(0, 1)}
                        onMouseUp={() => handleMove(0, 0)}
                        onMouseLeave={() => handleMove(0, 0)}
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-7 w-7" />
                      </button>
                      <button
                        type="button"
                        className="flex aspect-square items-center justify-center rounded-[20px] border border-[#d8c58a] bg-[#fff6d8] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                        onTouchStart={() => handleMove(1, 0)}
                        onTouchEnd={() => handleMove(0, 0)}
                        onTouchCancel={() => handleMove(0, 0)}
                        onMouseDown={() => handleMove(1, 0)}
                        onMouseUp={() => handleMove(0, 0)}
                        onMouseLeave={() => handleMove(0, 0)}
                        aria-label="Move right"
                      >
                        <ChevronRight className="h-7 w-7" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SurfaceViewport>
    </div>
  );
}
