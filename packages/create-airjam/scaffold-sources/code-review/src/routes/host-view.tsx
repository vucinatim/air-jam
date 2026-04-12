import { useAirJamHost, useHostRuntimeStateBridge } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  JoinQrOverlay,
  JoinUrlControls,
  LifecycleActionGroup,
  SurfaceViewport,
  useHostLobbyShell,
} from "@air-jam/sdk/ui";
import { useVisualHarnessBridge } from "@air-jam/visual-harness/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { codeReviewVisualHarnessBridge } from "../../visual/contract";
import {
  FIGHTER_SLOTS,
  HOST_STATUS_COPY,
  MAX_HP,
  TEAM1_COLOR,
  TEAM2_COLOR,
} from "../game/engine/constants";
import {
  createArenaColors,
  drawFrame,
  setupCanvas,
} from "../game/engine/render";
import {
  createHpState,
  createKoState,
  createRuntimePlayerState,
} from "../game/engine/runtime-state";
import { stepMatchFrame } from "../game/engine/simulation";
import {
  createEmptySpriteMap,
  tintSprite,
  tintSpriteCanvas,
} from "../game/engine/sprites";
import type {
  HpState,
  PlayerKey,
  SlotParticipant,
  SpriteKey,
  SpriteTintCacheKey,
  SpriteVariant,
} from "../game/engine/types";
import { gameInputSchema } from "../game/input";
import { MATCH_POINTS_TO_WIN } from "../game/match-config";
import { useGameStore } from "../game/stores";
import defendSprite from "/sprites/defend.png";
import endSprite from "/sprites/end.png";
import leftExtendedSprite from "/sprites/left-extended.png";
import leftShortSprite from "/sprites/left-short.png";
import rightExtendedSprite from "/sprites/right-extended.png";
import rightShortSprite from "/sprites/right-short.png";

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const previewControllersEnabled = import.meta.env.DEV;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const spritesRef = useRef<Record<SpriteKey, HTMLCanvasElement | null>>(
    createEmptySpriteMap(),
  );

  const hitFlashSpriteCacheRef = useRef<
    Record<SpriteTintCacheKey, HTMLCanvasElement>
  >({});

  const getTintedOverlaySprite = useCallback(
    (
      spriteKey: SpriteKey,
      sprite: HTMLCanvasElement,
      color: string,
    ): HTMLCanvasElement => {
      const cacheKey = `${spriteKey}:${color}` as SpriteTintCacheKey;
      const cached = hitFlashSpriteCacheRef.current[cacheKey];
      if (cached) return cached;

      const tinted = tintSpriteCanvas(sprite, color);
      hitFlashSpriteCacheRef.current[cacheKey] = tinted;
      return tinted;
    },
    [],
  );

  const teamAssignments = useGameStore((state) => state.teamAssignments);
  const botCounts = useGameStore((state) => state.botCounts);
  const matchPhase = useGameStore((state) => state.matchPhase);
  const matchSummary = useGameStore((state) => state.matchSummary);
  const scores = useGameStore((state) => state.scores);
  const actions = useGameStore.useActions();
  const hpSnapshotRef = useRef({ team1: MAX_HP, team2: MAX_HP });
  const [hpDisplay, setHpDisplay] = useState(() => ({
    team1: MAX_HP,
    team2: MAX_HP,
  }));
  const [audioMuted, setAudioMuted] = useState(false);
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
  const crowdAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioMutedRef = useRef(false);

  useEffect(() => {
    audioMutedRef.current = audioMuted;
  }, [audioMuted]);

  const copyPlayerId = async (playerId: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(playerId);
      setCopiedPlayerId(playerId);
      setTimeout(() => setCopiedPlayerId(null), 900);
    } catch {
      // Fallback for older browsers
      const fallbackField = document.createElement("textarea");
      fallbackField.value = playerId;
      fallbackField.style.position = "fixed";
      fallbackField.style.opacity = "0";
      document.body.appendChild(fallbackField);
      fallbackField.select();
      try {
        document.execCommand("copy");
        setCopiedPlayerId(playerId);
        setTimeout(() => setCopiedPlayerId(null), 900);
      } catch {
        // Ignore copy failure.
      } finally {
        document.body.removeChild(fallbackField);
      }
    }
  };

  const hostStatusText = useMemo(
    () => HOST_STATUS_COPY[host.connectionStatus] ?? host.connectionStatus,
    [host.connectionStatus],
  );

  const connectedPlayerIds = useMemo(
    () => host.players.map((player) => player.id),
    [host.players],
  );
  const assignedHumanPlayers = useMemo(
    () => host.players.filter((player) => teamAssignments[player.id]),
    [host.players, teamAssignments],
  );
  const humanBySlotKey = useMemo(() => {
    const bySlot = new Map<PlayerKey, { id: string; label: string }>();
    assignedHumanPlayers.forEach((player) => {
      const assignment = teamAssignments[player.id];
      if (!assignment) {
        return;
      }
      const slotKey =
        `${assignment.team === "team1" ? "player1" : "player2"}${assignment.position === "front" ? "Front" : "Back"}` as PlayerKey;
      bySlot.set(slotKey, { id: player.id, label: player.label });
    });
    return bySlot;
  }, [assignedHumanPlayers, teamAssignments]);
  const slotParticipants = useMemo<SlotParticipant[]>(() => {
    const remainingBots = { ...botCounts };
    const participants: SlotParticipant[] = [];

    FIGHTER_SLOTS.forEach((slot) => {
      const human = humanBySlotKey.get(slot.slotKey);
      if (human) {
        participants.push({
          id: human.id,
          label: human.label,
          slotKey: slot.slotKey,
          team: slot.team,
          position: slot.position,
          isBot: false,
        });
        return;
      }

      if (remainingBots[slot.team] <= 0) {
        return;
      }
      remainingBots[slot.team] -= 1;

      participants.push({
        id: slot.botId,
        label: slot.botLabel,
        slotKey: slot.slotKey,
        team: slot.team,
        position: slot.position,
        isBot: true,
      });
    });
    return participants;
  }, [botCounts, humanBySlotKey]);
  const participantBySlot = useMemo(
    () =>
      Object.fromEntries(
        slotParticipants.map((participant) => [
          participant.slotKey,
          participant,
        ]),
      ) as Partial<Record<PlayerKey, SlotParticipant>>,
    [slotParticipants],
  );
  const botCount = useMemo(
    () => slotParticipants.filter((participant) => participant.isBot).length,
    [slotParticipants],
  );
  const team1BotCount = useMemo(
    () =>
      slotParticipants.filter(
        (participant) => participant.isBot && participant.team === "team1",
      ).length,
    [slotParticipants],
  );
  const team2BotCount = useMemo(
    () =>
      slotParticipants.filter(
        (participant) => participant.isBot && participant.team === "team2",
      ).length,
    [slotParticipants],
  );
  const team1Occupancy = useMemo(
    () =>
      slotParticipants.filter((participant) => participant.team === "team1")
        .length,
    [slotParticipants],
  );
  const team2Occupancy = useMemo(
    () =>
      slotParticipants.filter((participant) => participant.team === "team2")
        .length,
    [slotParticipants],
  );
  const canStartMatch = useMemo(
    () =>
      matchPhase === "lobby" &&
      host.connectionStatus === "connected" &&
      team1Occupancy > 0 &&
      team2Occupancy > 0 &&
      assignedHumanPlayers.length > 0,
    [
      assignedHumanPlayers.length,
      host.connectionStatus,
      matchPhase,
      team1Occupancy,
      team2Occupancy,
    ],
  );
  const hostLobbyShell = useHostLobbyShell({
    joinUrl: host.joinUrl,
    canStartMatch,
  });
  useVisualHarnessBridge(codeReviewVisualHarnessBridge, {
    host,
    matchPhase,
    runtimeState: host.runtimeState,
    actions,
    scores,
  });

  useHostRuntimeStateBridge({
    matchPhase,
    runtimeState: host.runtimeState,
    toggleRuntimeState: host.toggleRuntimeState,
  });

  useEffect(() => {
    actions.syncConnectedPlayers({ connectedPlayerIds });
  }, [actions, connectedPlayerIds]);

  useEffect(() => {
    if (matchPhase !== "playing") {
      return;
    }
    if (
      scores.team1 < MATCH_POINTS_TO_WIN &&
      scores.team2 < MATCH_POINTS_TO_WIN
    ) {
      return;
    }
    actions.finishMatch();
  }, [actions, matchPhase, scores.team1, scores.team2]);

  // Load and tint all sprite variants
  useEffect(() => {
    const variants: { variant: SpriteVariant; url: string }[] = [
      { variant: "LeftShort", url: leftShortSprite },
      { variant: "RightShort", url: rightShortSprite },
      { variant: "LeftExtended", url: leftExtendedSprite },
      { variant: "RightExtended", url: rightExtendedSprite },
      { variant: "Defend", url: defendSprite },
      { variant: "End", url: endSprite },
    ];
    const teams: { team: "team1" | "team2"; color: string }[] = [
      { team: "team1", color: TEAM1_COLOR },
      { team: "team2", color: TEAM2_COLOR },
    ];

    for (const { team, color } of teams) {
      for (const { variant, url } of variants) {
        const img = new Image();
        const key: SpriteKey = `${team}${variant}`;
        img.onload = () => {
          spritesRef.current[key] = tintSprite(img, color);
        };
        img.src = url;
      }
    }
  }, []);

  // Loop crowd ambience with a first-interaction fallback for autoplay policies.
  useEffect(() => {
    const crowdAudio = new Audio("/sounds/crowd.mp3");
    crowdAudioRef.current = crowdAudio;
    crowdAudio.loop = true;
    crowdAudio.volume = audioMutedRef.current ? 0 : 0.28;

    const startAudio = () => {
      void crowdAudio.play().catch(() => {
        // Browser blocked autoplay; user interaction handlers stay active.
      });
    };

    const startOnInteraction = () => {
      startAudio();
      window.removeEventListener("pointerdown", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    };

    startAudio();
    window.addEventListener("pointerdown", startOnInteraction, { once: true });
    window.addEventListener("keydown", startOnInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
      crowdAudio.pause();
      crowdAudio.currentTime = 0;
      if (crowdAudioRef.current === crowdAudio) {
        crowdAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const crowdAudio = crowdAudioRef.current;
    if (!crowdAudio) return;
    crowdAudio.volume = audioMuted ? 0 : 0.28;
  }, [audioMuted]);

  // Pre-load one-shot sound effects
  const sfxRef = useRef({
    bell: new Audio("/sounds/bell.mp3"),
    hit1: new Audio("/sounds/hit1.mp3"),
    hit2: new Audio("/sounds/hit2.mp3"),
    missed: new Audio("/sounds/missed.mp3"),
  });

  /** Fire-and-forget a one-shot sound, rewinding if already playing. */
  const playSfx = useRef((key: keyof typeof sfxRef.current) => {
    if (audioMutedRef.current) {
      return;
    }
    const audio = sfxRef.current[key];
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay blocked — ignored for SFX.
    });
  });

  const prevMatchPhaseRef = useRef(matchPhase);
  useEffect(() => {
    if (prevMatchPhaseRef.current !== "playing" && matchPhase === "playing") {
      playSfx.current("bell");
    }
    prevMatchPhaseRef.current = matchPhase;
  }, [matchPhase]);

  const gameStateRef = useRef(createRuntimePlayerState());
  const hpRef = useRef<HpState>(createHpState());
  const koRef = useRef(createKoState());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const arenaColors = createArenaColors(
      getComputedStyle(document.documentElement),
    );
    setupCanvas(canvas, context);

    let animationId = 0;
    let lastFrameTime = performance.now();

    const syncHpDisplay = () => {
      const nextHp = hpRef.current;
      if (
        hpSnapshotRef.current.team1 !== nextHp.team1 ||
        hpSnapshotRef.current.team2 !== nextHp.team2
      ) {
        hpSnapshotRef.current = { ...nextHp };
        setHpDisplay({ ...nextHp });
      }
    };

    const loop = () => {
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;
      const timestamp = Date.now();

      if (matchPhase === "playing" && host.runtimeState === "playing") {
        stepMatchFrame({
          state: gameStateRef.current,
          participants: slotParticipants,
          participantBySlot,
          hpState: hpRef.current,
          koState: koRef.current,
          dt,
          timestamp,
          getInput: (controllerId) => host.getInput(controllerId),
          onMiss: () => playSfx.current("missed"),
          onHit: () => playSfx.current(Math.random() > 0.5 ? "hit1" : "hit2"),
          onBell: () => playSfx.current("bell"),
          onScore: (team) => actions.scorePoint({ team }),
          onHeavyHit: (controllerId) => {
            host.sendSignal("HAPTIC", { pattern: "heavy" }, controllerId);
          },
        });
      }

      syncHpDisplay();
      drawFrame({
        context,
        now,
        timestamp,
        state: gameStateRef.current,
        participantBySlot,
        sprites: spritesRef.current,
        getTintedOverlaySprite,
        arenaColors,
        koState: koRef.current,
      });

      animationId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationId);
  }, [
    actions,
    getTintedOverlaySprite,
    host,
    matchPhase,
    participantBySlot,
    slotParticipants,
  ]);

  return (
    <div className="host-view-shell">
      <SurfaceViewport
        preset="host-standard"
        className="bg-[var(--ring-mat-color,#e5e7eb)]"
      >
        <div
          className="relative flex h-full w-full flex-col items-center justify-center p-4"
          style={{ backgroundColor: "var(--ring-mat-color, #e5e7eb)" }}
        >
          <div className="mb-4 flex w-full items-center">
            <div className="flex w-1/3 justify-center">
              <div className="relative">
                <span
                  style={{
                    color: "rgb(220, 38, 38)",
                    whiteSpace: "nowrap",
                  }}
                  className="pixel-font text-7xl leading-none"
                >
                  {hpDisplay.team1}
                </span>
              </div>
            </div>

            <div className="flex w-1/3 justify-center">
              <canvas ref={canvasRef} className="block" />
            </div>

            <div className="flex w-1/3 justify-center">
              <div className="relative">
                <span
                  style={{
                    color: "rgb(37, 99, 235)",
                    whiteSpace: "nowrap",
                  }}
                  className="pixel-font text-7xl leading-none"
                >
                  {hpDisplay.team2}
                </span>
              </div>
            </div>
          </div>
          {matchPhase === "lobby" ? (
            <div className="absolute inset-0 z-50 overflow-y-auto bg-black/65 p-2 sm:p-3 md:p-4">
              <div className="flex min-h-full w-full items-center justify-center">
                <div
                  className="pixel-font relative flex w-full max-w-[96vw] flex-col overflow-hidden rounded-none border-4 border-zinc-700 bg-zinc-900 text-zinc-100 shadow-[6px_6px_0_rgba(0,0,0,0.8)] xl:max-w-[1780px] 2xl:max-w-[1920px]"
                  style={{
                    height: "auto",
                    maxHeight: "none",
                  }}
                >
                  <div className="min-h-0 flex-1 p-3 sm:p-4 md:p-5">
                    <div className="grid h-full min-h-0 gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(36rem,1fr)]">
                      <div className="order-1 flex h-44 items-center justify-center rounded-none border-4 border-zinc-700 bg-black p-1 sm:h-52 md:h-60 xl:h-auto xl:min-h-0">
                        <img
                          src="/sprites/cover.png"
                          alt="Game cover"
                          className="h-full w-full object-cover object-center"
                        />
                      </div>

                      <div className="order-2 flex min-h-0 flex-col xl:order-2">
                        <div className="space-y-2 md:space-y-3">
                          <div>
                            <p className="text-[10px] tracking-[0.22em] text-zinc-400 uppercase">
                              Room
                            </p>
                            <p className="text-lg text-white">{host.roomId}</p>
                          </div>

                          <div className="inline-flex text-xs tracking-[0.22em] uppercase">
                            <span className="rounded-none border-2 border-zinc-600 px-2 py-1">
                              {hostStatusText}
                            </span>
                          </div>

                          <JoinUrlControls
                            value={hostLobbyShell.joinUrlValue}
                            label="Join URL"
                            copied={hostLobbyShell.copied}
                            onCopy={hostLobbyShell.handleCopy}
                            onOpen={hostLobbyShell.handleOpen}
                            qrVisible={hostLobbyShell.joinQrVisible}
                            onToggleQr={hostLobbyShell.toggleJoinQr}
                            className="pt-1"
                            inputClassName="pixel-font border-2 border-zinc-600 bg-black/80 text-xs text-zinc-100"
                            buttonClassName="border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                          />
                        </div>

                        <div className="mt-2 min-h-0 flex-1 rounded-none border-4 border-zinc-700 bg-zinc-900/45 p-3 md:mt-3">
                          <div className="flex h-full min-h-0 flex-col">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] tracking-[0.22em] text-zinc-400 uppercase">
                                Connected Players ({host.players.length})
                              </p>
                              <span className="text-[10px] tracking-[0.18em] text-zinc-400 uppercase">
                                Humans {assignedHumanPlayers.length}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                              Auto Bots {botCount} (Coder {team1BotCount},
                              Reviewer {team2BotCount})
                            </p>

                            <ul className="mt-2 space-y-1 pr-1">
                              {slotParticipants.map((participant) => (
                                <li
                                  key={participant.slotKey}
                                  className="flex items-center justify-between border-b border-zinc-700 pb-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="block wrap-break-word text-zinc-100">
                                      {participant.label}
                                    </span>
                                    <span className="block text-[10px] tracking-[0.15em] text-zinc-400 uppercase">
                                      {participant.team === "team1"
                                        ? "Coder"
                                        : "Reviewer"}{" "}
                                      •{" "}
                                      {participant.position === "front"
                                        ? "Front"
                                        : "Back"}{" "}
                                      • {participant.isBot ? "Bot" : "Human"}
                                    </span>
                                  </div>
                                  {participant.isBot ? (
                                    <span className="text-[10px] tracking-[0.15em] text-zinc-500 uppercase">
                                      Auto
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="text-left text-[10px] text-zinc-300 underline-offset-2 hover:underline"
                                      onClick={() =>
                                        copyPlayerId(participant.id)
                                      }
                                      title="Copy player ID"
                                    >
                                      {copiedPlayerId === participant.id
                                        ? "Copied!"
                                        : participant.id.slice(0, 8)}
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <LifecycleActionGroup
                            phase="lobby"
                            canInteract={canStartMatch}
                            onStart={() => {
                              if (!canStartMatch) return;
                              actions.startMatch();
                            }}
                            startLabel="Play"
                            buttonClassName="rounded-none border-4 border-zinc-300 bg-zinc-800 text-white enabled:hover:bg-zinc-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <JoinQrOverlay
                  open={hostLobbyShell.joinQrVisible}
                  value={hostLobbyShell.joinUrlValue}
                  roomId={host.roomId}
                  onClose={hostLobbyShell.hideJoinQr}
                  description="Scan with your phone to join this Code Review room as a controller."
                  panelClassName="rounded-none border-4 border-zinc-300 bg-zinc-950"
                />
              </div>
            </div>
          ) : null}

          {matchPhase === "ended" ? (
            <div className="absolute inset-0 z-50 overflow-y-auto bg-black/65 p-3 sm:p-4">
              <div className="flex min-h-full w-full items-center justify-center">
                <div className="pixel-font w-full max-w-2xl rounded-none border-4 border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-[6px_6px_0_rgba(0,0,0,0.8)]">
                  <p className="text-xs tracking-[0.2em] text-zinc-400 uppercase">
                    Match Ended
                  </p>
                  <p className="mt-2 text-3xl text-white">
                    {matchSummary?.winner === "draw"
                      ? "Draw"
                      : matchSummary?.winner === "team1"
                        ? "Coder Team Wins"
                        : "Reviewer Team Wins"}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                    <div className="rounded-none border-2 border-zinc-700 bg-zinc-800/70 p-4">
                      <p className="text-xs tracking-[0.16em] text-zinc-400 uppercase">
                        Coder
                      </p>
                      <p className="mt-2 text-5xl text-red-500">
                        {matchSummary?.scores.team1 ?? scores.team1}
                      </p>
                    </div>
                    <div className="rounded-none border-2 border-zinc-700 bg-zinc-800/70 p-4">
                      <p className="text-xs tracking-[0.16em] text-zinc-400 uppercase">
                        Reviewer
                      </p>
                      <p className="mt-2 text-5xl text-blue-500">
                        {matchSummary?.scores.team2 ?? scores.team2}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => actions.resetToLobby()}
                      className="rounded-none border-4 border-zinc-300 bg-zinc-800 px-6 py-3 text-sm uppercase transition hover:bg-zinc-700"
                    >
                      Back To Lobby
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {matchPhase === "playing" && host.runtimeState !== "playing" ? (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/45">
              <div className="pixel-font rounded-none border-4 border-zinc-600 bg-zinc-900/90 px-6 py-4 text-center text-zinc-100">
                <p className="text-sm tracking-[0.18em] uppercase">
                  Match Paused
                </p>
                <p className="mt-2 text-xs text-zinc-300">
                  Waiting for runtime reconnect...
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        enabled={previewControllersEnabled}
        dockAccessory={
          <HostMuteButton
            muted={audioMuted}
            onToggle={() => setAudioMuted((previous) => !previous)}
          />
        }
      />
    </div>
  );
}
