import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import {
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
        controller.gameState === "playing",
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
  const isDead = myStats ? !myStats.alive : false;

  return (
    <div className="controller-view-shell">
      <ForcedOrientationShell desired="portrait">
        <div className="flex h-full w-full flex-col gap-3 bg-[#fdf6e3] p-3">
          {controller.gameState !== "playing" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="bg-[#fef3c7] p-4 shadow-md">
                <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
                  Room
                </p>
                <p className="text-xl font-bold text-[#5c4a2e]">
                  {controller.roomId ?? "Connecting..."}
                </p>
                <p className="mt-2 text-sm text-[#6b7280]">
                  Ready {readyCount}/{selectedPlayerCount} picked
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#fff6d8] p-2 shadow-md">
                <p className="mb-2 text-[11px] tracking-[0.18em] text-[#8b6914] uppercase">
                  Pick Your Character
                </p>
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

              <button
                type="button"
                disabled={!canToggleReady}
                onClick={() => {
                  if (!canToggleReady) return;
                  actions.setReady({ ready: !isReady });
                }}
                className="h-20 bg-[#8b6914] text-lg font-bold tracking-wide text-[#fdf6e3] uppercase shadow-md transition enabled:active:scale-[0.98] disabled:opacity-40"
              >
                {hasCharacterSelection
                  ? isReady
                    ? "Ready"
                    : "Tap To Ready"
                  : "Pick Character"}
              </button>

              <p className="text-center text-sm text-[#6b7280]">
                Choose your character, ready up, then wait for host start.
              </p>
            </div>
          ) : null}

          {controller.gameState === "playing" ? (
            <>
              <div className="flex h-12 items-center justify-between bg-[#fef3c7] px-4 shadow-md">
                <div className="flex items-center gap-2">
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
                    <span className="text-xl font-bold text-[#5c4a2e]">
                      {myPlayer?.name?.charAt(0) || "?"}
                    </span>
                  )}
                  <span className="text-lg font-bold text-[#5c4a2e]">
                    {isDead ? "💀 MRTVEC" : myPlayer?.name || "Povezujem..."}
                  </span>
                </div>
                <span className="text-2xl font-bold text-[#8b6914]">
                  {totalMoney} EUR
                </span>
              </div>

              {gameOver ? (
                <div className="flex flex-col items-center justify-center bg-[#fef3c7] py-8 text-center shadow-md">
                  <div className="mb-2 text-2xl font-bold text-[#c06030]">
                    KONEC IGRE
                  </div>
                  <div className="text-lg text-[#5c4a2e]">
                    Vsi igralci so umrli...
                  </div>
                  <div className="mt-2 text-xl font-semibold text-[#8b6914]">
                    Skupaj: {totalMoney} EUR
                  </div>
                </div>
              ) : isDead ? (
                <div className="flex items-center justify-center bg-[#fef3c7] py-4 text-lg font-bold text-[#5c4a2e]">
                  💀 Umrli ste! Opazujete iz onstranstva...
                </div>
              ) : (
                <>
                  {myStats ? (
                    <div className="flex flex-col gap-3 bg-[#fef3c7] p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-sm text-[#5c4a2e]">
                          Energija
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded-full bg-[#e8dcc8]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              myStats.energy > 30
                                ? "bg-[#d46060]"
                                : "bg-[#a03030]"
                            }`}
                            style={{ width: `${myStats.energy}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm text-[#5c4a2e]">
                          {Math.round(myStats.energy)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-sm text-[#5c4a2e]">
                          Sreča
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded-full bg-[#e8dcc8]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              myStats.boredom > 30
                                ? "bg-[#5b9bd5]"
                                : "bg-[#3a7bb5]"
                            }`}
                            style={{ width: `${myStats.boredom}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm text-[#5c4a2e]">
                          {Math.round(myStats.boredom)}%
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {isBusy ? (
                    <div className="flex flex-col gap-2 bg-[#fef3c7] p-3 shadow-sm">
                      <div className="flex items-center justify-center text-lg font-bold text-[#5c4a2e]">
                        ⏳ {myTaskName}
                      </div>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-[#e8dcc8]">
                        <div
                          className="h-full rounded-full bg-[#6aaa64] transition-all duration-100"
                          style={{ width: `${myProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-12">
                      <button
                        type="button"
                        className="h-32 w-32 touch-none bg-[#fef3c7] text-2xl font-black text-[#5c4a2e] shadow-lg transition-transform select-none active:scale-95"
                        onTouchStart={() => handleAction(true)}
                        onTouchEnd={() => handleAction(false)}
                        onTouchCancel={() => handleAction(false)}
                        onMouseDown={() => handleAction(true)}
                        onMouseUp={() => handleAction(false)}
                        onMouseLeave={() => handleAction(false)}
                      >
                        DELAJ
                      </button>

                      <div className="grid h-40 w-64 grid-cols-3 grid-rows-2 gap-3">
                        <div />
                        <button
                          type="button"
                          className="flex touch-none items-center justify-center bg-[#fef3c7] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                          onTouchStart={() => handleMove(0, -1)}
                          onTouchEnd={() => handleMove(0, 0)}
                          onTouchCancel={() => handleMove(0, 0)}
                          onMouseDown={() => handleMove(0, -1)}
                          onMouseUp={() => handleMove(0, 0)}
                          onMouseLeave={() => handleMove(0, 0)}
                        >
                          <ChevronUp className="h-10 w-10" />
                        </button>
                        <div />
                        <button
                          type="button"
                          className="flex touch-none items-center justify-center bg-[#fef3c7] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                          onTouchStart={() => handleMove(-1, 0)}
                          onTouchEnd={() => handleMove(0, 0)}
                          onTouchCancel={() => handleMove(0, 0)}
                          onMouseDown={() => handleMove(-1, 0)}
                          onMouseUp={() => handleMove(0, 0)}
                          onMouseLeave={() => handleMove(0, 0)}
                        >
                          <ChevronLeft className="h-10 w-10" />
                        </button>
                        <button
                          type="button"
                          className="flex touch-none items-center justify-center bg-[#fef3c7] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                          onTouchStart={() => handleMove(0, 1)}
                          onTouchEnd={() => handleMove(0, 0)}
                          onTouchCancel={() => handleMove(0, 0)}
                          onMouseDown={() => handleMove(0, 1)}
                          onMouseUp={() => handleMove(0, 0)}
                          onMouseLeave={() => handleMove(0, 0)}
                        >
                          <ChevronDown className="h-10 w-10" />
                        </button>
                        <button
                          type="button"
                          className="flex touch-none items-center justify-center bg-[#fef3c7] text-[#5c4a2e] shadow-md select-none active:bg-[#fde68a]"
                          onTouchStart={() => handleMove(1, 0)}
                          onTouchEnd={() => handleMove(0, 0)}
                          onTouchCancel={() => handleMove(0, 0)}
                          onMouseDown={() => handleMove(1, 0)}
                          onMouseUp={() => handleMove(0, 0)}
                          onMouseLeave={() => handleMove(0, 0)}
                        >
                          <ChevronRight className="h-10 w-10" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      </ForcedOrientationShell>
    </div>
  );
}
