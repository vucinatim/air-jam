/**
 * Controller surface for the-office.
 *
 * The controller shows the assigned player's stats, the current busy task
 * (if any), and a d-pad + primary action bound to the declared controls,
 * which the SDK sends to the host. Phase switches (lobby / playing
 * / ended) come from the networked `spaceStore`.
 */
import { useAirJamController, useAirJamStore } from "@air-jam/sdk";
import {
  ControlButton,
  ControllerPrimaryAction,
  LifecycleActionGroup,
  RuntimeShellHeader,
  Stick,
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
import { useMemo } from "react";
import {
  getPlayerById,
  getPlayerCapabilityHighlights,
  PLAYERS,
} from "../game/content/players";
import { officeInput } from "../game/contracts/input";
import {
  spaceStore,
  useOfficeFinalTotalMoney,
  useOfficeGameOver,
  useOfficeLifecycleVersion,
  useOfficeMatchPhase,
  useOfficePlayerAssignment,
  useOfficePlayerBusyTask,
  useOfficePlayerStats,
  useOfficeSelectedPlayerCount,
  useOfficeTotalMoney,
} from "../game/stores";

export function ControllerView() {
  const controller = useAirJamController();
  const roomId = useAirJamController((state) => state.roomId);
  const controllerId = useAirJamController((state) => state.controllerId);
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const runtimeState = useAirJamController((state) => state.runtimeState);
  const players = useAirJamController((state) => state.players);

  const matchPhase = useOfficeMatchPhase();
  const myPlayerId = useOfficePlayerAssignment(controllerId);
  const myPlayer = useMemo(
    () => (myPlayerId ? getPlayerById(myPlayerId) : null),
    [myPlayerId],
  );
  const lifecycleVersion = useOfficeLifecycleVersion();
  const connectedPlayerIds = useMemo(
    () => players.map((player) => player.id),
    [players],
  );
  const selectedPlayerCount = useOfficeSelectedPlayerCount(connectedPlayerIds);
  const connectedPlayerCount = players.length;
  const hasCharacterSelection = Boolean(myPlayerId);
  const canStartMatch =
    connectionStatus === "connected" &&
    selectedPlayerCount > 0 &&
    selectedPlayerCount === connectedPlayerCount;

  const actions = spaceStore.actions;
  const shellStatus = useControllerShellStatus({
    roomId,
    connectionStatus,
    playerLabel: myPlayer?.name ?? null,
    roomFallback: "Connecting...",
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canSendSystemCommand: connectionStatus === "connected",
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onTogglePause: () =>
      controller.sendSystemCommand(
        runtimeState === "playing" ? "pause" : "resume",
      ),
    onBackToLobby: () => actions.returnToLobby(),
    onRestart: () => actions.restartMatch(),
  });
  const handleBackToLobby = lifecycleIntents.onBackToLobby ?? (() => {});
  const handleRestart = lifecycleIntents.onRestart ?? (() => {});

  const showLobbyView = matchPhase === "lobby";
  const showEndedView = matchPhase === "ended";
  const showGameplayView =
    matchPhase === "playing" &&
    runtimeState === "playing" &&
    connectionStatus === "connected";
  const showPausedView = matchPhase === "playing" && !showGameplayView;
  const desiredOrientation =
    showLobbyView || showEndedView ? "portrait" : "landscape";
  const lobbyPrimaryHelper = canStartMatch
    ? "Everyone has picked a coworker."
    : !hasCharacterSelection
      ? "Pick a coworker to join the shift."
      : `${selectedPlayerCount}/${connectedPlayerCount} coworkers picked.`;

  return (
    <SurfaceViewport orientation={desiredOrientation}>
      <div className="flex h-full w-full flex-col gap-3 bg-[radial-gradient(circle_at_top,#6b5336_0%,#413323_34%,#221a13_100%)] p-3 text-[var(--airjam-color-text-paper)]">
        <RuntimeShellHeader
          connectionStatus={connectionStatus}
          leftSlot={
            <div className="flex min-w-0 items-center gap-3">
              {myPlayer ? (
                <img
                  src={myPlayer.image}
                  alt={myPlayer.name}
                  className="h-10 w-10 rounded-full border border-[var(--airjam-color-text-faded-brown)] object-cover object-top"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--airjam-color-text-faded-brown)] bg-[var(--airjam-color-text-warm)] text-[0.6875rem] font-bold text-[var(--airjam-color-paper-gold)]">
                  {shellStatus.identityInitial}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--airjam-color-paper-light)]">
                  {shellStatus.displayName}
                </p>
                <p className="text-[0.625rem] tracking-[0.16em] text-[var(--airjam-color-border-gold)] uppercase sm:text-[0.6875rem]">
                  {shellStatus.roomLine}
                </p>
              </div>
            </div>
          }
          rightSlot={
            showLobbyView ? null : (
              <LifecycleActionGroup
                phase={matchPhase}
                runtimeState={runtimeState}
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
                buttonClassName="rounded-none border-[var(--airjam-color-border-gold)]/40 bg-[var(--airjam-color-paper-light)]/10 text-[var(--airjam-color-paper-light)] hover:bg-[var(--airjam-color-paper-light)]/20"
              />
            )
          }
          className="border-[var(--airjam-color-text-soft-brown)] bg-[var(--airjam-color-text-brown)]/92"
        />

        {showLobbyView ? (
          <OfficeControllerLobbyView
            controllerId={controllerId}
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
            runtimeState={runtimeState}
            canInteract={lifecyclePermissions.canInteractForPhase}
            onBackToLobby={handleBackToLobby}
            onRestart={handleRestart}
          />
        ) : null}

        {showGameplayView ? (
          <OfficeControllerGameplayView
            key={`${controllerId}:${lifecycleVersion}`}
            controllerId={controllerId}
          />
        ) : null}
      </div>
    </SurfaceViewport>
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
  const playerAssignments = useAirJamStore(
    spaceStore,
    (state) => state.playerAssignments,
  );
  const actions = spaceStore.actions;
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

  const taskDurationMs = useAirJamStore(
    spaceStore,
    (state) => state.taskDurationMs,
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
              taskDurationMs,
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
                className={`border-2 bg-[var(--airjam-color-paper-pale-gold)] p-2 text-left shadow-sm transition ${
                  selectedByMe
                    ? "border-[var(--airjam-color-button)]"
                    : "border-[var(--airjam-color-border-light)]"
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
                    <p className="text-sm font-bold text-[var(--airjam-color-text-paper)]">
                      {playerOption.name}
                    </p>
                    <p className="text-[10px] tracking-[0.12em] text-[var(--airjam-color-button)] uppercase">
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
                      className="flex items-center justify-between text-[10px] text-[var(--airjam-color-text-paper)]"
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
        <span className="text-sm font-bold text-[var(--airjam-color-paper-light)]">
          {hasCharacterSelection
            ? `${myPlayer?.name ?? "Worker"} selected`
            : "Pick a coworker first"}
        </span>
        <span className="text-[10px] tracking-[0.12em] text-[var(--airjam-color-border-gold)] uppercase">
          {selectedPlayerCount}/{connectedPlayerCount}
        </span>
      </div>

      <ControllerPrimaryAction
        label="Start Match"
        helper={lobbyPrimaryHelper}
        disabled={!canStartMatch}
        onPress={() => actions.startMatch()}
        icon={<BriefcaseBusiness className="h-6 w-6" />}
        buttonClassName="rounded-none border-[var(--airjam-color-button)]/30 bg-[var(--airjam-color-button)] text-[var(--airjam-color-paper-cream)] hover:bg-[var(--airjam-color-button-hover)] disabled:bg-[var(--airjam-color-button-disabled)] disabled:text-[var(--airjam-color-paper-disabled)]"
      />
    </div>
  );
}

function OfficeControllerPausedView() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-[var(--airjam-color-text-soft-brown)] bg-[var(--airjam-color-text-deep-brown)]/90 p-4 shadow-md">
      <div className="max-w-sm text-center">
        <p className="text-xs tracking-[0.2em] text-[var(--airjam-color-border-gold)] uppercase">
          Match Paused
        </p>
        <p className="mt-2 text-sm text-[var(--airjam-color-paper-warm)]">
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
    <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--airjam-color-paper-pale-gold)] p-4 shadow-md">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[28px] border border-[var(--airjam-color-border-light)] bg-[var(--airjam-color-paper-disabled)] px-5 py-6 text-center shadow-sm">
        <p className="text-xs tracking-[0.2em] text-[var(--airjam-color-button)] uppercase">
          Shift Ended
        </p>
        <p className="mt-2 text-2xl font-bold text-[var(--airjam-color-text-paper)]">
          Final Earnings
        </p>
        <p className="mt-2 text-3xl font-black text-[var(--airjam-color-button)]">
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
          buttonClassName="h-11 w-full justify-center rounded-none border-[var(--airjam-color-button)]/30 bg-[var(--airjam-color-button)] px-4 text-[0.6875rem] font-black tracking-[0.16em] text-[var(--airjam-color-paper-cream)] uppercase hover:bg-[var(--airjam-color-button-hover)]"
        />
      </div>
    </div>
  );
}

function OfficeControllerGameplayView({
  controllerId,
}: {
  controllerId: string | null;
}) {
  const gameOver = useOfficeGameOver();
  const myStats = useOfficePlayerStats(controllerId);
  const totalMoney = useOfficeTotalMoney();
  const isDead = myStats ? !myStats.alive : false;

  if (gameOver) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-[28px] border border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper-disabled)] p-5 text-center shadow-md">
        <div className="max-w-sm">
          <p className="text-xs tracking-[0.22em] text-[var(--airjam-color-button)] uppercase">
            Konec igre
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--airjam-color-warning)]">
            Vsi igralci so umrli
          </p>
          <p className="mt-2 text-base text-[var(--airjam-color-text-paper)]">
            Skupaj zbrano: {totalMoney} EUR
          </p>
        </div>
      </div>
    );
  }

  if (isDead) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-[28px] border border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper-disabled)] p-5 text-center shadow-md">
        <div className="max-w-sm">
          <p className="text-xs tracking-[0.22em] text-[var(--airjam-color-button)] uppercase">
            Ste mrtvi
          </p>
          <p className="mt-2 text-xl font-bold text-[var(--airjam-color-text-paper)]">
            Opazujete iz onstranstva
          </p>
          <p className="mt-2 text-sm text-[var(--airjam-color-text-gray)]">
            Vaš del igre je končan. Počakajte na naslednji krog.
          </p>
        </div>
      </div>
    );
  }

  return <OfficeControllerPlayingControls controllerId={controllerId} />;
}

const padArrowClass = (lit: boolean) =>
  `flex items-center justify-center border text-[var(--airjam-color-text-paper)] transition ${
    lit
      ? "border-[var(--airjam-color-button)] bg-[var(--airjam-color-control-active)]/35"
      : "border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper)]"
  }`;

function OfficeControllerPlayingControls({
  controllerId,
}: {
  controllerId: string | null;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
      <Stick
        control={officeInput.move}
        directions="4-way"
        deadzone={0.22}
        aria-label="Movement pad"
        className="min-h-0 rounded-[28px] border border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper-disabled)] shadow-md"
      >
        {({ value }) => (
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2 p-4">
            <div />
            <div className={padArrowClass(value.y === 1)}>
              <ChevronUp className="h-8 w-8" />
            </div>
            <div />
            <div className={padArrowClass(value.x === -1)}>
              <ChevronLeft className="h-8 w-8" />
            </div>
            <div className="border border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper-light-gold)]/60" />
            <div className={padArrowClass(value.x === 1)}>
              <ChevronRight className="h-8 w-8" />
            </div>
            <div />
            <div className={padArrowClass(value.y === -1)}>
              <ChevronDown className="h-8 w-8" />
            </div>
            <div />
          </div>
        )}
      </Stick>

      <div className="flex min-h-0 flex-col gap-3">
        <OfficeControllerGameplayStatusCard controllerId={controllerId} />

        <ControlButton
          control={officeInput.action}
          className="flex min-h-[50%] flex-1 items-center justify-center border border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper-light-gold)] px-5 text-4xl font-black text-[var(--airjam-color-text-paper)] shadow-lg transition-transform active:scale-[0.98] data-[active=true]:scale-[0.98]"
        >
          WORK
        </ControlButton>
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
    <div className="grid gap-1.5 border border-[var(--airjam-color-border-paper)] bg-[var(--airjam-color-paper-disabled)] p-3 shadow-sm">
      <div className="flex items-center justify-between text-[10px] tracking-[0.14em] uppercase">
        <span className="text-[var(--airjam-color-button)]">Earned</span>
        <span className="font-black text-[var(--airjam-color-text-paper)]">
          EUR {totalMoney}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase">
        <span className="w-16 shrink-0 text-[var(--airjam-color-button)]">
          Energy
        </span>
        <div className="h-2 flex-1 overflow-hidden bg-[var(--airjam-color-paper-muted)]">
          <div
            className={`h-full transition-all duration-300 ${
              energyValue > 30
                ? "bg-[var(--airjam-color-energy-bar)]"
                : "bg-[var(--airjam-color-energy-bar-low)]"
            }`}
            style={{ width: `${energyValue}%` }}
          />
        </div>
        <span className="w-8 text-right font-black text-[var(--airjam-color-text-paper)]">
          {Math.round(energyValue)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase">
        <span className="w-16 shrink-0 text-[var(--airjam-color-button)]">
          Happy
        </span>
        <div className="h-2 flex-1 overflow-hidden bg-[var(--airjam-color-paper-muted)]">
          <div
            className={`h-full transition-all duration-300 ${
              boredomValue > 30
                ? "bg-[var(--airjam-color-player2)]"
                : "bg-[var(--airjam-color-boredom-bar-low)]"
            }`}
            style={{ width: `${boredomValue}%` }}
          />
        </div>
        <span className="w-8 text-right font-black text-[var(--airjam-color-text-paper)]">
          {Math.round(boredomValue)}
        </span>
      </div>
      {myTaskName ? (
        <div className="flex items-center justify-between text-[10px] tracking-[0.14em] uppercase">
          <span className="truncate text-[var(--airjam-color-button)]">
            Working
          </span>
          <span className="truncate font-black text-[var(--airjam-color-text-paper)]">
            {myTaskName}
          </span>
        </div>
      ) : null}
    </div>
  );
}
