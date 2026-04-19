/**
 * Controller surface for the-office.
 *
 * The controller shows the assigned player's stats, the current busy task
 * (if any), and a d-pad + primary action. It publishes direction + action
 * intent to the host via `useInputWriter`. Phase switches (lobby / playing
 * / ended) come from the networked `useSpaceStore`.
 */
import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import {
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  useOfficeFinalTotalMoney,
  useOfficeGameOver,
  useOfficeMatchPhase,
  useOfficePlayerAssignment,
  useOfficePlayerBusyTask,
  useOfficePlayerStats,
  useOfficeSelectedPlayerCount,
  useOfficeTotalMoney,
  useSpaceStore,
} from "../game/stores";
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
  const activePadPointerIdRef = useRef<number | null>(null);
  const [padDirection, setPadDirection] = useState({ x: 0, y: 0 });

  const matchPhase = useOfficeMatchPhase();
  const myPlayerId = useOfficePlayerAssignment(controller.controllerId);
  const myPlayer = useMemo(
    () => (myPlayerId ? getPlayerById(myPlayerId) : null),
    [myPlayerId],
  );
  const myTaskName = useOfficePlayerBusyTask(controller.controllerId);
  const isBusy = Boolean(myTaskName);
  const connectedPlayerIds = useMemo(
    () => controller.players.map((player) => player.id),
    [controller.players],
  );
  const selectedPlayerCount = useOfficeSelectedPlayerCount(connectedPlayerIds);
  const connectedPlayerCount = controller.players.length;
  const hasCharacterSelection = Boolean(myPlayerId);
  const canStartMatch =
    controller.connectionStatus === "connected" &&
    selectedPlayerCount > 0 &&
    selectedPlayerCount === connectedPlayerCount;

  const actions = useSpaceStore.useActions();
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
    onBackToLobby: () => actions.returnToLobby(),
    onRestart: () => actions.restartMatch(),
  });
  const handleBackToLobby = lifecycleIntents.onBackToLobby ?? (() => {});
  const handleRestart = lifecycleIntents.onRestart ?? (() => {});

  const showLobbyView = matchPhase === "lobby";
  const showEndedView = matchPhase === "ended";
  const showGameplayView =
    matchPhase === "playing" && controller.runtimeState === "playing";
  const showPausedView = matchPhase === "playing" && !showGameplayView;
  const desiredOrientation =
    showLobbyView || showEndedView ? "portrait" : "landscape";
  const lobbyPrimaryHelper = canStartMatch
    ? "Everyone has picked a coworker."
    : !hasCharacterSelection
      ? "Pick a coworker to join the shift."
      : `${selectedPlayerCount}/${connectedPlayerCount} coworkers picked.`;

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

  const handleMove = (screenX: number, screenY: number) => {
    movementRef.current = { x: screenY, y: -screenX };
    setPadDirection({ x: screenX, y: screenY });
  };

  const resolvePadDirection = useCallback(
    (target: HTMLDivElement, clientX: number, clientY: number) => {
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normalizedX = (clientX - centerX) / (rect.width / 2 || 1);
      const normalizedY = (clientY - centerY) / (rect.height / 2 || 1);
      const absX = Math.abs(normalizedX);
      const absY = Math.abs(normalizedY);

      if (Math.max(absX, absY) < 0.22) {
        return { x: 0, y: 0 };
      }

      if (absX > absY) {
        return { x: normalizedX > 0 ? 1 : -1, y: 0 };
      }

      return { x: 0, y: normalizedY > 0 ? 1 : -1 };
    },
    [],
  );

  const handlePadPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      activePadPointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      const nextDirection = resolvePadDirection(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      handleMove(nextDirection.x, nextDirection.y);
    },
    [resolvePadDirection],
  );

  const handlePadPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activePadPointerIdRef.current !== event.pointerId) {
        return;
      }
      const nextDirection = resolvePadDirection(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      handleMove(nextDirection.x, nextDirection.y);
    },
    [resolvePadDirection],
  );

  const resetPad = useCallback(() => {
    activePadPointerIdRef.current = null;
    handleMove(0, 0);
  }, []);

  const handleAction = (pressed: boolean) => {
    actionRef.current = pressed;
  };

  return (
    <div className="controller-view-shell">
      <SurfaceViewport
        orientation={desiredOrientation}
        preset="controller-phone"
      >
        <div className="flex h-full w-full flex-col gap-3 bg-[radial-gradient(circle_at_top,#6b5336_0%,#413323_34%,#221a13_100%)] p-3 text-[#5c4a2e]">
          <RuntimeShellHeader
            connectionStatus={controller.connectionStatus}
            leftSlot={
              <div className="flex min-w-0 items-center gap-3">
                {myPlayer ? (
                  <img
                    src={myPlayer.image}
                    alt={myPlayer.name}
                    className="h-10 w-10 rounded-full border border-[#9d8450] object-cover object-top"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#9d8450] bg-[#4a3925] text-[0.6875rem] font-bold text-[#f7e7b1]">
                    {shellStatus.identityInitial}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#fff1c4]">
                    {shellStatus.displayName}
                  </p>
                  <p className="text-[0.625rem] tracking-[0.16em] text-[#d9bb63] uppercase sm:text-[0.6875rem]">
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
                  buttonClassName="rounded-none border-[#8b6914]/25 bg-[#8b6914]/10 text-[#7a5b11] hover:bg-[#8b6914]/18"
                />
              )
            }
            className="border-[#7d6640] bg-[#3a2f22]/92"
          />

          {showLobbyView ? (
            <OfficeControllerLobbyView
              controllerId={controller.controllerId}
              connectedPlayerCount={connectedPlayerCount}
              selectedPlayerCount={selectedPlayerCount}
              canStartMatch={canStartMatch}
              hasCharacterSelection={hasCharacterSelection}
              lobbyPrimaryHelper={lobbyPrimaryHelper}
            />
          ) : null}

          {showPausedView ? <OfficeControllerPausedView /> : null}

          {showEndedView ? (
            <OfficeControllerEndedView
              matchPhase={matchPhase}
              runtimeState={controller.runtimeState}
              canInteract={lifecyclePermissions.canInteractForPhase}
              onBackToLobby={handleBackToLobby}
              onRestart={handleRestart}
            />
          ) : null}

          {showGameplayView ? (
            <OfficeControllerGameplayView
              controllerId={controller.controllerId}
              padDirection={padDirection}
              handleAction={handleAction}
              handlePadPointerDown={handlePadPointerDown}
              handlePadPointerMove={handlePadPointerMove}
              resetPad={resetPad}
            />
          ) : null}
        </div>
      </SurfaceViewport>
    </div>
  );
}

function OfficeControllerLobbyView({
  controllerId,
  connectedPlayerCount,
  selectedPlayerCount,
  canStartMatch,
  hasCharacterSelection,
  lobbyPrimaryHelper,
}: {
  controllerId: string | null;
  connectedPlayerCount: number;
  selectedPlayerCount: number;
  canStartMatch: boolean;
  hasCharacterSelection: boolean;
  lobbyPrimaryHelper: string;
}) {
  const playerAssignments = useSpaceStore((state) => state.playerAssignments);
  const actions = useSpaceStore.useActions();
  const myPlayerId = controllerId
    ? (playerAssignments[controllerId] ?? null)
    : null;
  const characterOwnerById = useMemo(() => {
    const ownerByCharacterId = new Map<string, string>();
    Object.entries(playerAssignments).forEach(
      ([ownerControllerId, playerId]) => {
        ownerByCharacterId.set(playerId, ownerControllerId);
      },
    );
    return ownerByCharacterId;
  }, [playerAssignments]);
  const myPlayer = useMemo(
    () => (myPlayerId ? getPlayerById(myPlayerId) : null),
    [myPlayerId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {PLAYERS.map((playerOption) => {
            const ownerControllerId = characterOwnerById.get(playerOption.id);
            const selectedByMe = myPlayerId === playerOption.id;
            const takenByOtherController =
              ownerControllerId !== undefined &&
              ownerControllerId !== controllerId;
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
                  if (takenByOtherController) {
                    return;
                  }
                  actions.selectCharacter({
                    playerId: playerOption.id,
                  });
                }}
                className={`border-2 bg-[#fef3c7] p-2 text-left shadow-sm transition ${
                  selectedByMe ? "border-[#8b6914]" : "border-[#e5d4ab]"
                } ${takenByOtherController ? "opacity-45" : "active:scale-[0.98]"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <img
                    src={playerOption.image}
                    alt={playerOption.name}
                    className={`h-12 w-12 object-cover object-top ${
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
            ? `${myPlayer?.name ?? "Worker"} selected`
            : "Pick a coworker first"}
        </span>
        <span className="text-[10px] tracking-[0.12em] text-[#8b6914] uppercase">
          {selectedPlayerCount}/{connectedPlayerCount}
        </span>
      </div>

      <ControllerPrimaryAction
        label="Start Match"
        helper={lobbyPrimaryHelper}
        disabled={!canStartMatch}
        onPress={() => actions.startMatch()}
        icon={<BriefcaseBusiness className="h-6 w-6" />}
        buttonClassName="rounded-none border-[#8b6914]/30 bg-[#8b6914] text-[#fdf6e3] hover:bg-[#7a5b11] disabled:bg-[#c7b384] disabled:text-[#fff8df]"
      />
    </div>
  );
}

function OfficeControllerPausedView() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-[#7d6640] bg-[#2e241a]/90 p-4 shadow-md">
      <div className="max-w-sm text-center">
        <p className="text-xs tracking-[0.2em] text-[#d9bb63] uppercase">
          Match Paused
        </p>
        <p className="mt-2 text-sm text-[#f3e7bf]">
          Waiting for runtime sync...
        </p>
      </div>
    </div>
  );
}

function OfficeControllerEndedView({
  matchPhase,
  runtimeState,
  canInteract,
  onBackToLobby,
  onRestart,
}: {
  matchPhase: "ended";
  runtimeState: "playing" | "paused";
  canInteract: boolean;
  onBackToLobby: () => void;
  onRestart: () => void;
}) {
  const finalTotalMoney = useOfficeFinalTotalMoney();

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-[#fef3c7] p-4 shadow-md">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[28px] border border-[#e5d4ab] bg-[#fff8df] px-5 py-6 text-center shadow-sm">
        <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
          Shift Ended
        </p>
        <p className="mt-2 text-2xl font-bold text-[#5c4a2e]">Final Earnings</p>
        <p className="mt-2 text-3xl font-black text-[#8b6914]">
          EUR {finalTotalMoney}
        </p>
        <LifecycleActionGroup
          phase={matchPhase}
          runtimeState={runtimeState}
          canInteract={canInteract}
          onBackToLobby={onBackToLobby}
          onRestart={onRestart}
          presentation="pill"
          visibleKinds={["back-to-lobby", "restart"]}
          className="w-full flex-col items-stretch gap-2 pt-1"
          buttonClassName="h-11 w-full justify-center rounded-none border-[#8b6914]/30 bg-[#8b6914] px-4 text-[0.6875rem] font-black tracking-[0.16em] text-[#fdf6e3] uppercase hover:bg-[#7a5b11]"
        />
      </div>
    </div>
  );
}

function OfficeControllerGameplayView({
  controllerId,
  padDirection,
  handleAction,
  handlePadPointerDown,
  handlePadPointerMove,
  resetPad,
}: {
  controllerId: string | null;
  padDirection: { x: number; y: number };
  handleAction: (pressed: boolean) => void;
  handlePadPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handlePadPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  resetPad: () => void;
}) {
  const gameOver = useOfficeGameOver();
  const myStats = useOfficePlayerStats(controllerId);
  const totalMoney = useOfficeTotalMoney();
  const isDead = myStats ? !myStats.alive : false;

  if (gameOver) {
    return (
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
    );
  }

  if (isDead) {
    return (
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
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
      <div
        className="relative min-h-0 rounded-[28px] border border-[#d8c58a] bg-[#fff8df] shadow-md"
        onPointerDown={handlePadPointerDown}
        onPointerMove={handlePadPointerMove}
        onPointerUp={resetPad}
        onPointerCancel={resetPad}
        onLostPointerCapture={resetPad}
        style={{ touchAction: "none" }}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2 p-4">
          <div />
          <div
            className={`flex items-center justify-center border text-[#5c4a2e] transition ${
              padDirection.y === -1
                ? "border-[#8b6914] bg-[#facc15]/35"
                : "border-[#d8c58a] bg-[#fff6d8]"
            }`}
          >
            <ChevronUp className="h-8 w-8" />
          </div>
          <div />
          <div
            className={`flex items-center justify-center border text-[#5c4a2e] transition ${
              padDirection.x === -1
                ? "border-[#8b6914] bg-[#facc15]/35"
                : "border-[#d8c58a] bg-[#fff6d8]"
            }`}
          >
            <ChevronLeft className="h-8 w-8" />
          </div>
          <div className="border border-[#d8c58a] bg-[#fff1bd]/60" />
          <div
            className={`flex items-center justify-center border text-[#5c4a2e] transition ${
              padDirection.x === 1
                ? "border-[#8b6914] bg-[#facc15]/35"
                : "border-[#d8c58a] bg-[#fff6d8]"
            }`}
          >
            <ChevronRight className="h-8 w-8" />
          </div>
          <div />
          <div
            className={`flex items-center justify-center border text-[#5c4a2e] transition ${
              padDirection.y === 1
                ? "border-[#8b6914] bg-[#facc15]/35"
                : "border-[#d8c58a] bg-[#fff6d8]"
            }`}
          >
            <ChevronDown className="h-8 w-8" />
          </div>
          <div />
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <OfficeControllerGameplayStatusCard controllerId={controllerId} />

        <button
          type="button"
          className="flex min-h-[50%] flex-1 items-center justify-center border border-[#d8c58a] bg-[#fff1bd] px-5 text-4xl font-black text-[#5c4a2e] shadow-lg transition-transform select-none active:scale-[0.98]"
          onTouchStart={() => handleAction(true)}
          onTouchEnd={() => handleAction(false)}
          onTouchCancel={() => handleAction(false)}
          onMouseDown={() => handleAction(true)}
          onMouseUp={() => handleAction(false)}
          onMouseLeave={() => handleAction(false)}
        >
          WORK
        </button>
      </div>
    </div>
  );
}

function OfficeControllerGameplayStatusCard({
  controllerId,
}: {
  controllerId: string | null;
}) {
  const totalMoney = useOfficeTotalMoney();
  const myStats = useOfficePlayerStats(controllerId);
  const myTaskName = useOfficePlayerBusyTask(controllerId);
  const energyValue = myStats?.energy ?? 0;
  const boredomValue = myStats?.boredom ?? 0;

  return (
    <div className="grid gap-1.5 border border-[#d8c58a] bg-[#fff8df] p-3 shadow-sm">
      <div className="flex items-center justify-between text-[10px] tracking-[0.14em] uppercase">
        <span className="text-[#8b6914]">Earned</span>
        <span className="font-black text-[#5c4a2e]">EUR {totalMoney}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase">
        <span className="w-16 shrink-0 text-[#8b6914]">Energy</span>
        <div className="h-2 flex-1 overflow-hidden bg-[#eadcbc]">
          <div
            className={`h-full transition-all duration-300 ${
              energyValue > 30 ? "bg-[#d46060]" : "bg-[#a03030]"
            }`}
            style={{ width: `${energyValue}%` }}
          />
        </div>
        <span className="w-8 text-right font-black text-[#5c4a2e]">
          {Math.round(energyValue)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase">
        <span className="w-16 shrink-0 text-[#8b6914]">Happy</span>
        <div className="h-2 flex-1 overflow-hidden bg-[#eadcbc]">
          <div
            className={`h-full transition-all duration-300 ${
              boredomValue > 30 ? "bg-[#5b9bd5]" : "bg-[#3a7bb5]"
            }`}
            style={{ width: `${boredomValue}%` }}
          />
        </div>
        <span className="w-8 text-right font-black text-[#5c4a2e]">
          {Math.round(boredomValue)}
        </span>
      </div>
      {myTaskName ? (
        <div className="flex items-center justify-between text-[10px] tracking-[0.14em] uppercase">
          <span className="truncate text-[#8b6914]">Working</span>
          <span className="truncate font-black text-[#5c4a2e]">
            {myTaskName}
          </span>
        </div>
      ) : null}
    </div>
  );
}
