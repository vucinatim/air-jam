import { useAirJamHost, useHostRuntimeStateBridge } from "@air-jam/sdk";
import {
  HostMuteButton,
  JoinUrlControls,
  LifecycleActionGroup,
  RoomQrCode,
  useHostLobbyShell,
} from "@air-jam/sdk/ui";
import {
  publishVisualHarnessBridgeActions,
  publishVisualHarnessBridgeSnapshot,
} from "@air-jam/visual-harness/runtime-bridge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Position, type Team } from "../game/domain/team-assignments";
import {
  type GameInput,
  gameInputSchema,
  PUNCH_COOLDOWN_MS,
  PUNCH_DURATION_MS,
} from "../game/input";
import { MATCH_POINTS_TO_WIN } from "../game/match-config";
import { useGameStore } from "../game/stores";
import defendSprite from "/sprites/defend.png";
import endSprite from "/sprites/end.png";
import leftExtendedSprite from "/sprites/left-extended.png";
import leftShortSprite from "/sprites/left-short.png";
import rightExtendedSprite from "/sprites/right-extended.png";
import rightShortSprite from "/sprites/right-short.png";

const FIELD_WIDTH = 720;
const FIELD_HEIGHT = 720;
const SPRITE_SCALE = 1.25;
const PLAYER_DRAW_SIZE = Math.round(120 * SPRITE_SCALE);
const PLAYER_SIZE = 30;
const PLAYER_SPAWN_OFFSET = 120;
const ACCELERATION = 0.4;
const FRICTION = 0.95;
const MAX_VELOCITY = 8;
const VELOCITY_EPSILON = 0.03;
const RING_PADDING = 42;
const ROPE_GAP = 14;
const COLLISION_PUSH = 3;
const HITBOX_CENTER = PLAYER_SIZE / 2;
const PLAYER_INSET_X = PLAYER_DRAW_SIZE * 0.25 - HITBOX_CENTER;

/** Instant positional displacement on punch hit (px) */
const PUNCH_DISPLACEMENT = 20;
/** Velocity set on the victim after a punch (bypasses MAX_VELOCITY) */
const PUNCH_KNOCKBACK_VELOCITY = 16;
/** Number of frames knockback velocity ignores MAX_VELOCITY clamping */
const PUNCH_KNOCKBACK_FRAMES = 8;
/** Small recoil velocity applied to the puncher on hit */
const PUNCH_RECOIL = 4;
/** Extra reach (px) added to the hitbox when a punch is active */
const PUNCH_HITBOX_EXTENSION = 35;

const MAX_HP = 100;
const PUNCH_DAMAGE = 10;
/** Damage multiplier when the victim is defending */
const DEFEND_DAMAGE_MULTIPLIER = 0.5;
/** Knockback multiplier when the victim is defending */
const DEFEND_KNOCKBACK_MULTIPLIER = 0.5;
/** Acceleration multiplier when defending */
const DEFEND_ACCELERATION_MULTIPLIER = 0.5;
/** Duration of the white flash when hit (ms) */
const HIT_FLASH_MS = 150;
/** Duration of the empowered state after blocking a hit (ms) */
const EMPOWER_DURATION_MS = 2000;
/** Damage multiplier when empowered */
const EMPOWER_DAMAGE_MULTIPLIER = 2;
/** Knockback multiplier when empowered */
const EMPOWER_KNOCKBACK_MULTIPLIER = 2;
/** Hit flash tint opacity */
const HIT_FLASH_TINT_ALPHA = 0.32;
/** Gold glow color for empowered players */
const EMPOWER_GLOW_COLOR = "#fbbf24";
/** Freeze duration after a KO before the next round starts (ms) */
const KO_COUNTDOWN_MS = 3000;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const HOST_STATUS_COPY: Record<string, string> = {
  idle: "Idle",
  connecting: "Waiting for server…",
  connected: "Ready for controllers",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting…",
};

const RING_MIN_X = RING_PADDING + PLAYER_INSET_X;
const RING_MAX_X = FIELD_WIDTH - RING_PADDING - PLAYER_SIZE - PLAYER_INSET_X;
const RING_MIN_Y = RING_PADDING + PLAYER_INSET_X;
const RING_MAX_Y = FIELD_HEIGHT - RING_PADDING - PLAYER_SIZE - PLAYER_INSET_X;
const SPAWN_Y = FIELD_HEIGHT / 2 - HITBOX_CENTER;
const SPAWN_X_PLAYER1_FRONT = clamp(
  PLAYER_SPAWN_OFFSET,
  RING_MIN_X,
  RING_MAX_X,
);
const SPAWN_X_PLAYER1_BACK = clamp(
  PLAYER_SPAWN_OFFSET / 2,
  RING_MIN_X,
  RING_MAX_X,
);
const SPAWN_X_PLAYER2_FRONT = clamp(
  FIELD_WIDTH - PLAYER_SPAWN_OFFSET - PLAYER_SIZE,
  RING_MIN_X,
  RING_MAX_X,
);
const SPAWN_X_PLAYER2_BACK = clamp(
  FIELD_WIDTH - PLAYER_SPAWN_OFFSET / 2 - PLAYER_SIZE,
  RING_MIN_X,
  RING_MAX_X,
);

type ArenaColors = {
  ringMat: string;
  ringMarkings: string;
  ringRopePrimary: string;
  ringRopeSecondary: string;
  cornerRed: string;
  cornerBlue: string;
  postBody: string;
  postTop: string;
};

const DEFAULT_ARENA_COLORS: ArenaColors = {
  ringMat: "#e5e7eb",
  ringMarkings: "#9ca3af",
  ringRopePrimary: "#dc2626",
  ringRopeSecondary: "#1d4ed8",
  cornerRed: "#dc2626",
  cornerBlue: "#2563eb",
  postBody: "#94a3b8",
  postTop: "#e2e8f0",
};

const readCssVar = (
  styles: CSSStyleDeclaration,
  variableName: string,
  fallback: string,
) => {
  const value = styles.getPropertyValue(variableName).trim();
  return value || fallback;
};

const PLAYER_KEYS = [
  "player1Front",
  "player1Back",
  "player2Front",
  "player2Back",
] as const;

type SpriteVariant =
  | "LeftShort"
  | "RightShort"
  | "LeftExtended"
  | "RightExtended"
  | "Defend"
  | "End";
type SpriteKey = `${"team1" | "team2"}${SpriteVariant}`;
type SpriteTintCacheKey = `${SpriteKey}:${string}`;

/** Idle animation: min/max ms per frame (each player gets a random duration) */
const IDLE_FRAME_MIN_MS = 350;
const IDLE_FRAME_MAX_MS = 800;

type PlayerKey = (typeof PLAYER_KEYS)[number];

type SlotParticipant = {
  id: string;
  label: string;
  slotKey: PlayerKey;
  team: Team;
  position: Position;
  isBot: boolean;
};

const FIGHTER_SLOTS: Array<{
  slotKey: PlayerKey;
  team: Team;
  position: Position;
  botId: string;
  botLabel: string;
}> = [
  {
    slotKey: "player1Front",
    team: "team1",
    position: "front",
    botId: "bot-team1-front",
    botLabel: "Coder Bot α",
  },
  {
    slotKey: "player1Back",
    team: "team1",
    position: "back",
    botId: "bot-team1-back",
    botLabel: "Coder Bot β",
  },
  {
    slotKey: "player2Front",
    team: "team2",
    position: "front",
    botId: "bot-team2-front",
    botLabel: "Reviewer Bot α",
  },
  {
    slotKey: "player2Back",
    team: "team2",
    position: "back",
    botId: "bot-team2-back",
    botLabel: "Reviewer Bot β",
  },
];

const BOT_FOLLOW_DISTANCE = 120;
const BOT_RETREAT_DISTANCE = 64;
const BOT_DEFEND_DISTANCE = 74;
const BOT_PUNCH_DISTANCE = 84;
const BOT_STRAFE_DISTANCE = 170;

type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  punchingLeft: boolean;
  punchingRight: boolean;
  /** Remaining cooldown before the left fist can fire again (ms) */
  cooldownLeft: number;
  /** Remaining cooldown before the right fist can fire again (ms) */
  cooldownRight: number;
  /** Timestamp (ms) at which the current left punch expires */
  punchEndLeft: number;
  /** Timestamp (ms) at which the current right punch expires */
  punchEndRight: number;
  /** Whether the current left punch has connected with an enemy */
  punchLandedLeft: boolean;
  /** Whether the current right punch has connected with an enemy */
  punchLandedRight: boolean;
  /** Remaining frames where velocity bypasses MAX_VELOCITY clamping */
  knockbackFrames: number;
  /** Whether the player is currently defending */
  defending: boolean;
  /** Timestamp (ms) until which the player flashes white after being hit */
  hitFlashEnd: number;
  /** Whether idle sprite is currently showing left (true) or right (false) */
  idleLeft: boolean;
  /** Timestamp when the next idle frame swap should happen */
  idleNextSwap: number;
  /** Timestamp (ms) until which the player's next punch is empowered (0 = not empowered) */
  empoweredUntil: number;
  /** Whether the current punch in flight was thrown while empowered */
  punchEmpowered: boolean;
};

const makePlayerState = (x: number, y: number): PlayerState => ({
  x,
  y,
  vx: 0,
  vy: 0,
  punchingLeft: false,
  punchingRight: false,
  cooldownLeft: 0,
  cooldownRight: 0,
  punchEndLeft: 0,
  punchEndRight: 0,
  punchLandedLeft: false,
  punchLandedRight: false,
  knockbackFrames: 0,
  defending: false,
  hitFlashEnd: 0,
  idleLeft: Math.random() > 0.5,
  idleNextSwap:
    performance.now() +
    IDLE_FRAME_MIN_MS +
    Math.random() * (IDLE_FRAME_MAX_MS - IDLE_FRAME_MIN_MS),
  empoweredUntil: 0,
  punchEmpowered: false,
});

const createBotInput = (
  participant: SlotParticipant,
  participants: SlotParticipant[],
  state: Record<PlayerKey, PlayerState>,
  timestamp: number,
): GameInput => {
  const selfState = state[participant.slotKey];
  const enemies = participants.filter(
    (entry) => entry.team !== participant.team,
  );

  if (enemies.length === 0) {
    return {
      vertical: 0,
      horizontal: 0,
      leftPunch: false,
      rightPunch: false,
      defend: false,
    };
  }

  let nearestEnemy = enemies[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  enemies.forEach((enemy) => {
    const enemyState = state[enemy.slotKey];
    const dx = enemyState.x - selfState.x;
    const dy = enemyState.y - selfState.y;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = enemy;
    }
  });

  const target = state[nearestEnemy.slotKey];
  const dx = target.x - selfState.x;
  const dy = target.y - selfState.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const towardX = dx / distance;
  const towardY = dy / distance;
  const pulseStep = Math.floor(timestamp / 220);
  const strafeDirection =
    (pulseStep + participant.slotKey.length) % 2 === 0 ? 1 : -1;

  let horizontal = 0;
  let vertical = 0;

  if (nearestDistance > BOT_FOLLOW_DISTANCE) {
    horizontal = towardX;
    vertical = towardY;
  } else if (nearestDistance < BOT_RETREAT_DISTANCE) {
    horizontal = -towardX;
    vertical = -towardY;
  } else {
    horizontal = towardX * 0.2;
    vertical = towardY * 0.2;
  }

  if (nearestDistance > BOT_STRAFE_DISTANCE) {
    horizontal += towardY * 0.35 * strafeDirection;
    vertical += -towardX * 0.35 * strafeDirection;
  }

  horizontal = clamp(horizontal, -1, 1);
  vertical = clamp(vertical, -1, 1);

  const enemyPunching = target.punchingLeft || target.punchingRight;
  const defend = nearestDistance <= BOT_DEFEND_DISTANCE && enemyPunching;
  const canPunch = nearestDistance <= BOT_PUNCH_DISTANCE && !defend;
  const prefersLeftPunch = (pulseStep + participant.id.length) % 2 === 0;

  return {
    vertical,
    horizontal,
    leftPunch: canPunch && prefersLeftPunch,
    rightPunch: canPunch && !prefersLeftPunch,
    defend,
  };
};

const TEAM1_COLOR = "#dc2626";
const TEAM2_COLOR = "#2563eb";

/** Create a tinted copy of an image on an offscreen canvas */
const tintSprite = (
  img: HTMLImageElement,
  color: string,
): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  return c;
};

/** Create a second tinted copy from an already tinted sprite for overlay effects */
const tintSpriteCanvas = (
  img: HTMLCanvasElement,
  color: string,
): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  return c;
};

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const spritesRef = useRef<Record<SpriteKey, HTMLCanvasElement | null>>({
    team1LeftShort: null,
    team1RightShort: null,
    team1LeftExtended: null,
    team1RightExtended: null,
    team1Defend: null,
    team1End: null,
    team2LeftShort: null,
    team2RightShort: null,
    team2LeftExtended: null,
    team2RightExtended: null,
    team2Defend: null,
    team2End: null,
  });

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

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    publishVisualHarnessBridgeSnapshot({
      roomId: host.roomId,
      controllerJoinUrl:
        host.joinUrlStatus === "ready" && host.joinUrl ? host.joinUrl : null,
      matchPhase,
      runtimeState: host.runtimeState,
    });
  }, [
    host.joinUrl,
    host.joinUrlStatus,
    host.roomId,
    host.runtimeState,
    matchPhase,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    publishVisualHarnessBridgeActions({
      forceEndMatch: (payload) => {
        const nextScores =
          payload && typeof payload === "object" && payload !== null
            ? (payload as {
                scores?: { team1?: number; team2?: number };
              })
            : null;

        const team1 =
          nextScores?.scores?.team1 ?? Math.max(MATCH_POINTS_TO_WIN, 1);
        const team2 = nextScores?.scores?.team2 ?? 0;
        const pointDiff = Math.max(0, team1 - scores.team1);
        for (let index = 0; index < pointDiff; index += 1) {
          actions.scorePoint({ team: "team1" });
        }

        const reviewerDiff = Math.max(0, team2 - scores.team2);
        for (let index = 0; index < reviewerDiff; index += 1) {
          actions.scorePoint({ team: "team2" });
        }

        actions.finishMatch();
        return true;
      },
    });
  }, [actions, scores.team1, scores.team2]);

  useHostRuntimeStateBridge({
    matchPhase,
    runtimeState: host.runtimeState,
    toggleRuntimeState: host.toggleRuntimeState,
  });

  const prevRuntimeStateRef = useRef(host.runtimeState);
  useEffect(() => {
    const previousRuntimeState = prevRuntimeStateRef.current;
    prevRuntimeStateRef.current = host.runtimeState;

    if (matchPhase !== "playing") {
      return;
    }

    if (previousRuntimeState === "playing" && host.runtimeState !== "playing") {
      actions.resetToLobby();
    }
  }, [actions, host.runtimeState, matchPhase]);

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

  // Play bell when the match transitions to "playing"
  const prevMatchPhaseRef = useRef(matchPhase);
  useEffect(() => {
    if (prevMatchPhaseRef.current !== "playing" && matchPhase === "playing") {
      playSfx.current("bell");
    }
    prevMatchPhaseRef.current = matchPhase;
  }, [matchPhase]);

  // Per-player physics + punch state
  const gameState = useRef<Record<PlayerKey, PlayerState>>({
    player1Front: makePlayerState(SPAWN_X_PLAYER1_FRONT, SPAWN_Y),
    player1Back: makePlayerState(SPAWN_X_PLAYER1_BACK, SPAWN_Y),
    player2Front: makePlayerState(SPAWN_X_PLAYER2_FRONT, SPAWN_Y),
    player2Back: makePlayerState(SPAWN_X_PLAYER2_BACK, SPAWN_Y),
  });

  // Track which controllers have been hit this frame (for haptic feedback deduplication)
  const hitControllersRef = useRef<Set<string>>(new Set());

  // Per-team HP pool
  const hpRef = useRef({ team1: MAX_HP, team2: MAX_HP });

  // KO countdown state
  const koRef = useRef<{
    active: boolean;
    winner: "team1" | "team2" | null;
    endTime: number;
  }>({ active: false, winner: null, endTime: 0 });

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rootStyles = getComputedStyle(document.documentElement);
    const arenaColors: ArenaColors = {
      ringMat: readCssVar(
        rootStyles,
        "--ring-mat-color",
        DEFAULT_ARENA_COLORS.ringMat,
      ),
      ringMarkings: readCssVar(
        rootStyles,
        "--ring-markings-color",
        DEFAULT_ARENA_COLORS.ringMarkings,
      ),
      ringRopePrimary: readCssVar(
        rootStyles,
        "--ring-rope-primary-color",
        DEFAULT_ARENA_COLORS.ringRopePrimary,
      ),
      ringRopeSecondary: readCssVar(
        rootStyles,
        "--ring-rope-secondary-color",
        DEFAULT_ARENA_COLORS.ringRopeSecondary,
      ),
      cornerRed: readCssVar(
        rootStyles,
        "--ring-corner-red-color",
        DEFAULT_ARENA_COLORS.cornerRed,
      ),
      cornerBlue: readCssVar(
        rootStyles,
        "--ring-corner-blue-color",
        DEFAULT_ARENA_COLORS.cornerBlue,
      ),
      postBody: readCssVar(
        rootStyles,
        "--ring-post-body-color",
        DEFAULT_ARENA_COLORS.postBody,
      ),
      postTop: readCssVar(
        rootStyles,
        "--ring-post-top-color",
        DEFAULT_ARENA_COLORS.postTop,
      ),
    };

    const dpr = window.devicePixelRatio || 1;
    canvas.width = FIELD_WIDTH * dpr;
    canvas.height = FIELD_HEIGHT * dpr;
    canvas.style.width = `${FIELD_WIDTH}px`;
    canvas.style.height = `${FIELD_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    let animationId: number;
    let lastFrameTime = performance.now();

    const gameLoop = () => {
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;

      const state = gameState.current;
      const participants = slotParticipants;
      const isPlaying =
        matchPhase === "playing" && host.runtimeState === "playing";
      const timestamp = Date.now();

      const syncHpDisplay = () => {
        const nextTeam1Hp = hpRef.current.team1;
        const nextTeam2Hp = hpRef.current.team2;
        if (
          hpSnapshotRef.current.team1 !== nextTeam1Hp ||
          hpSnapshotRef.current.team2 !== nextTeam2Hp
        ) {
          hpSnapshotRef.current = { team1: nextTeam1Hp, team2: nextTeam2Hp };
          setHpDisplay(hpSnapshotRef.current);
        }
      };

      // Clear hit tracking each frame
      hitControllersRef.current.clear();

      if (isPlaying) {
        // KO freeze: skip all physics while the countdown runs
        if (koRef.current.active) {
          if (timestamp >= koRef.current.endTime) {
            // Countdown finished — reset for next round
            const winner = koRef.current.winner;
            if (winner) actions.scorePoint({ team: winner });

            hpRef.current = { team1: MAX_HP, team2: MAX_HP };
            syncHpDisplay();
            state.player1Front = makePlayerState(
              SPAWN_X_PLAYER1_FRONT,
              SPAWN_Y,
            );
            state.player1Back = makePlayerState(SPAWN_X_PLAYER1_BACK, SPAWN_Y);
            state.player2Front = makePlayerState(
              SPAWN_X_PLAYER2_FRONT,
              SPAWN_Y,
            );
            state.player2Back = makePlayerState(SPAWN_X_PLAYER2_BACK, SPAWN_Y);

            koRef.current = { active: false, winner: null, endTime: 0 };
            playSfx.current("bell");
          }
          // Whether we just reset or are still counting — skip physics this frame
        } else {
          // Limit to one hit sound per frame to avoid stacking
          let hitSoundPlayedThisFrame = false;

          // Process participant input and punching
          participants.forEach((participant) => {
            const input = participant.isBot
              ? createBotInput(participant, participants, state, timestamp)
              : host.getInput(participant.id);

            if (input) {
              const ps = state[participant.slotKey];

              // Decrement cooldowns using real delta time
              ps.cooldownLeft = Math.max(0, ps.cooldownLeft - dt);
              ps.cooldownRight = Math.max(0, ps.cooldownRight - dt);

              // Auto-reset punches based on stored end times.
              // If the punch expired without landing, play the miss sound.
              if (ps.punchingLeft && timestamp >= ps.punchEndLeft) {
                if (!ps.punchLandedLeft) playSfx.current("missed");
                ps.punchingLeft = false;
                ps.punchLandedLeft = false;
              }
              if (ps.punchingRight && timestamp >= ps.punchEndRight) {
                if (!ps.punchLandedRight) playSfx.current("missed");
                ps.punchingRight = false;
                ps.punchLandedRight = false;
              }
              // Clear empowered flag when no punch is active
              if (!ps.punchingLeft && !ps.punchingRight) {
                ps.punchEmpowered = false;
              }

              // Defend state — can't punch while defending
              ps.defending = input.defend;

              // Trigger punches from input (blocked while defending)
              if (!ps.defending) {
                if (input.leftPunch && ps.cooldownLeft <= 0) {
                  ps.punchingLeft = true;
                  ps.punchLandedLeft = false;
                  ps.cooldownLeft = PUNCH_COOLDOWN_MS;
                  ps.punchEndLeft = timestamp + PUNCH_DURATION_MS;
                  // Consume empowered on throw
                  if (timestamp < ps.empoweredUntil) {
                    ps.punchEmpowered = true;
                    ps.empoweredUntil = 0;
                  }
                }

                if (input.rightPunch && ps.cooldownRight <= 0) {
                  ps.punchingRight = true;
                  ps.punchLandedRight = false;
                  ps.cooldownRight = PUNCH_COOLDOWN_MS;
                  ps.punchEndRight = timestamp + PUNCH_DURATION_MS;
                  // Consume empowered on throw (if not already consumed by left punch this frame)
                  if (timestamp < ps.empoweredUntil) {
                    ps.punchEmpowered = true;
                    ps.empoweredUntil = 0;
                  }
                }
              }

              // Expire empowered state
              if (ps.empoweredUntil > 0 && timestamp >= ps.empoweredUntil) {
                ps.empoweredUntil = 0;
              }

              // Movement — slower while defending, unclamped during knockback
              const accel = ps.defending
                ? ACCELERATION * DEFEND_ACCELERATION_MULTIPLIER
                : ACCELERATION;

              if (ps.knockbackFrames > 0) {
                ps.vx = (ps.vx + input.horizontal * accel) * FRICTION;
                ps.vy = (ps.vy + input.vertical * accel) * FRICTION;
                ps.knockbackFrames--;
              } else {
                ps.vx = clamp(
                  (ps.vx + input.horizontal * accel) * FRICTION,
                  -MAX_VELOCITY,
                  MAX_VELOCITY,
                );
                ps.vy = clamp(
                  (ps.vy + input.vertical * accel) * FRICTION,
                  -MAX_VELOCITY,
                  MAX_VELOCITY,
                );
              }

              if (Math.abs(ps.vx) < VELOCITY_EPSILON) {
                ps.vx = 0;
              }
              if (Math.abs(ps.vy) < VELOCITY_EPSILON) {
                ps.vy = 0;
              }

              ps.x = clamp(ps.x + ps.vx, RING_MIN_X, RING_MAX_X);
              ps.y = clamp(ps.y + ps.vy, RING_MIN_Y, RING_MAX_Y);
            }
          });

          const activeKeys = participants.map(
            (participant) => participant.slotKey,
          );

          // Build lightweight collision descriptors
          const activePlayers = activeKeys.map((k) => {
            const ps = state[k];
            const team = (k.startsWith("player1") ? "team1" : "team2") as
              | "team1"
              | "team2";
            const isPunching =
              (ps.punchingLeft && !ps.punchLandedLeft) ||
              (ps.punchingRight && !ps.punchLandedRight);

            // When punching, compute the direction toward the nearest enemy
            // and extend the hitbox along that vector.
            let extX = 0;
            let extY = 0;

            if (isPunching) {
              let nearestDist = Infinity;
              let angle = 0;

              for (const other of activeKeys) {
                if (other === k) continue;
                const otherTeam = other.startsWith("player1")
                  ? "team1"
                  : "team2";
                if (otherTeam === team) continue;

                const oPs = state[other];
                const dx = oPs.x + PLAYER_SIZE / 2 - (ps.x + PLAYER_SIZE / 2);
                const dy = oPs.y + PLAYER_SIZE / 2 - (ps.y + PLAYER_SIZE / 2);
                const dist = dx * dx + dy * dy;

                if (dist < nearestDist) {
                  nearestDist = dist;
                  angle = Math.atan2(dy, dx);
                }
              }

              extX = Math.cos(angle) * PUNCH_HITBOX_EXTENSION;
              extY = Math.sin(angle) * PUNCH_HITBOX_EXTENSION;
            }

            return { key: k, team, ps, isPunching, extX, extY };
          });

          // Handle collisions and punches
          for (let i = 0; i < activePlayers.length; i++) {
            for (let j = i + 1; j < activePlayers.length; j++) {
              const a = activePlayers[i];
              const b = activePlayers[j];

              // Expand each player's AABB by their punch extension (clamped to positive side only)
              const aMinX = a.ps.x + Math.min(0, a.extX);
              const aMaxX = a.ps.x + PLAYER_SIZE + Math.max(0, a.extX);
              const aMinY = a.ps.y + Math.min(0, a.extY);
              const aMaxY = a.ps.y + PLAYER_SIZE + Math.max(0, a.extY);

              const bMinX = b.ps.x + Math.min(0, b.extX);
              const bMaxX = b.ps.x + PLAYER_SIZE + Math.max(0, b.extX);
              const bMinY = b.ps.y + Math.min(0, b.extY);
              const bMaxY = b.ps.y + PLAYER_SIZE + Math.max(0, b.extY);

              const overlapX = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX);
              const overlapY = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY);

              if (overlapX <= 0 || overlapY <= 0) continue;

              const aIsPunchingB = a.isPunching && a.team !== b.team;
              const bIsPunchingA = b.isPunching && b.team !== a.team;

              if (aIsPunchingB || bIsPunchingA) {
                // Punch collision — apply strong knockback along the center-to-center axis
                const dx =
                  b.ps.x + PLAYER_SIZE / 2 - (a.ps.x + PLAYER_SIZE / 2);
                const dy =
                  b.ps.y + PLAYER_SIZE / 2 - (a.ps.y + PLAYER_SIZE / 2);
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;

                if (aIsPunchingB) {
                  const bDefending = b.ps.defending;
                  const defKbMult = bDefending
                    ? DEFEND_KNOCKBACK_MULTIPLIER
                    : 1;
                  const defDmgMult = bDefending ? DEFEND_DAMAGE_MULTIPLIER : 1;

                  // Empowered punch: 2x damage/knockback (consumed on throw)
                  const empKbMult = a.ps.punchEmpowered
                    ? EMPOWER_KNOCKBACK_MULTIPLIER
                    : 1;
                  const empDmgMult = a.ps.punchEmpowered
                    ? EMPOWER_DAMAGE_MULTIPLIER
                    : 1;

                  const kbMult = defKbMult * empKbMult;
                  const dmgMult = defDmgMult * empDmgMult;

                  // Instant displacement — makes the hit feel punchy
                  b.ps.x += nx * PUNCH_DISPLACEMENT * kbMult;
                  b.ps.y += ny * PUNCH_DISPLACEMENT * kbMult;
                  // Set (not add) high velocity for a satisfying skid
                  b.ps.vx = nx * PUNCH_KNOCKBACK_VELOCITY * kbMult;
                  b.ps.vy = ny * PUNCH_KNOCKBACK_VELOCITY * kbMult;
                  b.ps.knockbackFrames = PUNCH_KNOCKBACK_FRAMES;
                  // Puncher recoil
                  a.ps.vx -= nx * PUNCH_RECOIL;
                  a.ps.vy -= ny * PUNCH_RECOIL;

                  // Apply damage to victim team
                  hpRef.current[b.team] = Math.max(
                    0,
                    hpRef.current[b.team] - PUNCH_DAMAGE * dmgMult,
                  );
                  b.ps.hitFlashEnd = timestamp + HIT_FLASH_MS;

                  // Grant empowered state if victim was defending
                  if (bDefending) {
                    b.ps.empoweredUntil = timestamp + EMPOWER_DURATION_MS;
                  }

                  // Mark the active fist(s) as landed
                  if (a.ps.punchingLeft) a.ps.punchLandedLeft = true;
                  if (a.ps.punchingRight) a.ps.punchLandedRight = true;

                  // Play a random hit sound (once per frame)
                  if (!hitSoundPlayedThisFrame) {
                    playSfx.current(Math.random() > 0.5 ? "hit1" : "hit2");
                    hitSoundPlayedThisFrame = true;
                  }

                  // Send haptic feedback to B's controller (bots do not receive haptics)
                  const bParticipant = participantBySlot[b.key];
                  if (
                    bParticipant &&
                    !bParticipant.isBot &&
                    !hitControllersRef.current.has(bParticipant.id)
                  ) {
                    host.sendSignal(
                      "HAPTIC",
                      { pattern: "heavy" },
                      bParticipant.id,
                    );
                    hitControllersRef.current.add(bParticipant.id);
                  }
                }

                if (bIsPunchingA) {
                  const aDefending = a.ps.defending;
                  const defKbMult = aDefending
                    ? DEFEND_KNOCKBACK_MULTIPLIER
                    : 1;
                  const defDmgMult = aDefending ? DEFEND_DAMAGE_MULTIPLIER : 1;

                  // Empowered punch: 2x damage/knockback (consumed on throw)
                  const empKbMult = b.ps.punchEmpowered
                    ? EMPOWER_KNOCKBACK_MULTIPLIER
                    : 1;
                  const empDmgMult = b.ps.punchEmpowered
                    ? EMPOWER_DAMAGE_MULTIPLIER
                    : 1;

                  const kbMult = defKbMult * empKbMult;
                  const dmgMult = defDmgMult * empDmgMult;

                  // Instant displacement
                  a.ps.x -= nx * PUNCH_DISPLACEMENT * kbMult;
                  a.ps.y -= ny * PUNCH_DISPLACEMENT * kbMult;
                  // Set high velocity for skid
                  a.ps.vx = -nx * PUNCH_KNOCKBACK_VELOCITY * kbMult;
                  a.ps.vy = -ny * PUNCH_KNOCKBACK_VELOCITY * kbMult;
                  a.ps.knockbackFrames = PUNCH_KNOCKBACK_FRAMES;
                  // Puncher recoil
                  b.ps.vx += nx * PUNCH_RECOIL;
                  b.ps.vy += ny * PUNCH_RECOIL;

                  // Apply damage to victim team
                  hpRef.current[a.team] = Math.max(
                    0,
                    hpRef.current[a.team] - PUNCH_DAMAGE * dmgMult,
                  );
                  a.ps.hitFlashEnd = timestamp + HIT_FLASH_MS;

                  // Grant empowered state if victim was defending
                  if (aDefending) {
                    a.ps.empoweredUntil = timestamp + EMPOWER_DURATION_MS;
                  }

                  // Mark the active fist(s) as landed
                  if (b.ps.punchingLeft) b.ps.punchLandedLeft = true;
                  if (b.ps.punchingRight) b.ps.punchLandedRight = true;

                  // Play a random hit sound (once per frame)
                  if (!hitSoundPlayedThisFrame) {
                    playSfx.current(Math.random() > 0.5 ? "hit1" : "hit2");
                    hitSoundPlayedThisFrame = true;
                  }

                  // Send haptic feedback to A's controller (bots do not receive haptics)
                  const aParticipant = participantBySlot[a.key];
                  if (
                    aParticipant &&
                    !aParticipant.isBot &&
                    !hitControllersRef.current.has(aParticipant.id)
                  ) {
                    host.sendSignal(
                      "HAPTIC",
                      { pattern: "heavy" },
                      aParticipant.id,
                    );
                    hitControllersRef.current.add(aParticipant.id);
                  }
                }
              } else {
                // Normal body collision (use body-only AABB for separation)
                const bodyOverlapX =
                  Math.min(a.ps.x + PLAYER_SIZE, b.ps.x + PLAYER_SIZE) -
                  Math.max(a.ps.x, b.ps.x);
                const bodyOverlapY =
                  Math.min(a.ps.y + PLAYER_SIZE, b.ps.y + PLAYER_SIZE) -
                  Math.max(a.ps.y, b.ps.y);

                if (bodyOverlapX > 0 && bodyOverlapY > 0) {
                  if (bodyOverlapX < bodyOverlapY) {
                    const sign =
                      a.ps.x + PLAYER_SIZE / 2 < b.ps.x + PLAYER_SIZE / 2
                        ? -1
                        : 1;
                    const half = bodyOverlapX / 2;
                    a.ps.x += sign * half;
                    b.ps.x -= sign * half;
                    a.ps.vx += sign * COLLISION_PUSH;
                    b.ps.vx -= sign * COLLISION_PUSH;
                  } else {
                    const sign =
                      a.ps.y + PLAYER_SIZE / 2 < b.ps.y + PLAYER_SIZE / 2
                        ? -1
                        : 1;
                    const half = bodyOverlapY / 2;
                    a.ps.y += sign * half;
                    b.ps.y -= sign * half;
                    a.ps.vy += sign * COLLISION_PUSH;
                    b.ps.vy -= sign * COLLISION_PUSH;
                  }
                }
              }
            }
          }

          // Final hard clamp so nobody drifts out of bounds after collision resolution
          for (const { ps } of activePlayers) {
            ps.x = clamp(ps.x, RING_MIN_X, RING_MAX_X);
            ps.y = clamp(ps.y, RING_MIN_Y, RING_MAX_Y);
          }

          // KO detection — check if either team's HP hit 0
          const { team1: hp1, team2: hp2 } = hpRef.current;
          if (hp1 <= 0 || hp2 <= 0) {
            const winner = hp1 <= 0 ? "team2" : "team1";
            koRef.current = {
              active: true,
              winner,
              endTime: timestamp + KO_COUNTDOWN_MS,
            };
            playSfx.current("bell");
          }
          syncHpDisplay();
        } // close else (physics block — skipped during KO freeze)
      }

      // === Arena Drawing ===
      ctx.fillStyle = arenaColors.ringMat;
      ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

      const ringX = RING_PADDING;
      const ringY = RING_PADDING;
      const ringSize = FIELD_WIDTH - RING_PADDING * 2;

      ctx.fillStyle = arenaColors.ringMat;
      ctx.fillRect(ringX, ringY, ringSize, ringSize);

      ctx.strokeStyle = arenaColors.ringMarkings;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(FIELD_WIDTH / 2, ringY + 16);
      ctx.lineTo(FIELD_WIDTH / 2, ringY + ringSize - 16);
      ctx.moveTo(ringX + 16, FIELD_HEIGHT / 2);
      ctx.lineTo(ringX + ringSize - 16, FIELD_HEIGHT / 2);
      ctx.stroke();

      for (let i = 0; i < 3; i += 1) {
        const ropeInset = i * ROPE_GAP;
        ctx.strokeStyle =
          i === 1 ? arenaColors.ringRopePrimary : arenaColors.ringRopeSecondary;
        ctx.lineWidth = 4;
        ctx.strokeRect(
          ringX - ropeInset,
          ringY - ropeInset,
          ringSize + ropeInset * 2,
          ringSize + ropeInset * 2,
        );
      }

      ctx.fillStyle = arenaColors.cornerRed;
      ctx.fillRect(ringX - 18, ringY - 18, 36, 36);
      ctx.fillRect(ringX + ringSize - 18, ringY + ringSize - 18, 36, 36);
      ctx.fillStyle = arenaColors.cornerBlue;
      ctx.fillRect(ringX + ringSize - 18, ringY - 18, 36, 36);
      ctx.fillRect(ringX - 18, ringY + ringSize - 18, 36, 36);

      const postRadius = 10;
      const postPoints = [
        { x: ringX - ROPE_GAP * 2, y: ringY - ROPE_GAP * 2 },
        { x: ringX + ringSize + ROPE_GAP * 2, y: ringY - ROPE_GAP * 2 },
        { x: ringX - ROPE_GAP * 2, y: ringY + ringSize + ROPE_GAP * 2 },
        {
          x: ringX + ringSize + ROPE_GAP * 2,
          y: ringY + ringSize + ROPE_GAP * 2,
        },
      ];
      postPoints.forEach(({ x, y }) => {
        ctx.fillStyle = arenaColors.postTop;
        ctx.beginPath();
        ctx.arc(x, y, postRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = arenaColors.postBody;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // === Players (sprites with rotation toward nearest enemy) ===
      const active: {
        key: PlayerKey;
        team: "team1" | "team2";
        cx: number;
        cy: number;
        punchingLeft: boolean;
        punchingRight: boolean;
        defending: boolean;
        hitFlashEnd: number;
        idleLeft: boolean;
        empoweredUntil: number;
      }[] = [];

      for (const k of PLAYER_KEYS) {
        if (!participantBySlot[k]) {
          continue;
        }
        const team = k.startsWith("player1") ? "team1" : "team2";
        const ps = state[k];

        // Tick per-player idle animation
        if (now >= ps.idleNextSwap) {
          ps.idleLeft = !ps.idleLeft;
          ps.idleNextSwap =
            now +
            IDLE_FRAME_MIN_MS +
            Math.random() * (IDLE_FRAME_MAX_MS - IDLE_FRAME_MIN_MS);
        }

        active.push({
          key: k,
          team: team as "team1" | "team2",
          cx: ps.x + PLAYER_SIZE / 2,
          cy: ps.y + PLAYER_SIZE / 2,
          punchingLeft: ps.punchingLeft,
          punchingRight: ps.punchingRight,
          defending: ps.defending,
          hitFlashEnd: ps.hitFlashEnd,
          idleLeft: ps.idleLeft,
          empoweredUntil: ps.empoweredUntil,
        });
      }

      const koLoserTeam =
        koRef.current.active && koRef.current.winner
          ? koRef.current.winner === "team1"
            ? "team2"
            : "team1"
          : null;

      const knockedOut: (typeof active)[number][] = [];
      const activeTeam: (typeof active)[number][] = [];
      for (const p of active) {
        if (koLoserTeam && p.team === koLoserTeam) {
          knockedOut.push(p);
        } else {
          activeTeam.push(p);
        }
      }

      const drawPlayer = (p: (typeof active)[number]) => {
        // Select sprite: punch > defend > idle toggle
        const prefix = p.team === "team1" ? "team1" : "team2";
        const defaultSpriteKey = p.idleLeft
          ? (`${prefix}LeftShort` as const)
          : (`${prefix}RightShort` as const);
        const spriteKey =
          koLoserTeam === p.team
            ? (`${prefix}End` as const)
            : p.punchingLeft
              ? (`${prefix}LeftExtended` as const)
              : p.punchingRight
                ? (`${prefix}RightExtended` as const)
                : p.defending
                  ? (`${prefix}Defend` as const)
                  : defaultSpriteKey;
        const sprite =
          spritesRef.current[spriteKey] ?? spritesRef.current[defaultSpriteKey];
        if (!sprite) return;

        // Find nearest enemy for rotation (sprite faces "up" / -Y, so offset by PI/2)
        let angle = 0;
        let nearestDist = Infinity;
        for (const other of active) {
          if (other.team === p.team) continue;
          const dx = other.cx - p.cx;
          const dy = other.cy - p.cy;
          const dist = dx * dx + dy * dy;
          if (dist < nearestDist) {
            nearestDist = dist;
            angle = Math.atan2(dy, dx) + Math.PI / 2;
          }
        }

        ctx.save();
        ctx.translate(p.cx, p.cy);
        ctx.rotate(angle);
        ctx.drawImage(
          sprite,
          -PLAYER_DRAW_SIZE / 2,
          -PLAYER_DRAW_SIZE / 2,
          PLAYER_DRAW_SIZE,
          PLAYER_DRAW_SIZE,
        );

        // Hit flash tint overlay (use alternate team tint so it feels like a color shift)
        if (timestamp < p.hitFlashEnd) {
          const hitFlashColor = p.team === "team1" ? TEAM2_COLOR : TEAM1_COLOR;
          const hitFlashSprite = getTintedOverlaySprite(
            spriteKey,
            sprite,
            hitFlashColor,
          );
          ctx.globalAlpha = HIT_FLASH_TINT_ALPHA;
          ctx.drawImage(
            hitFlashSprite,
            -PLAYER_DRAW_SIZE / 2,
            -PLAYER_DRAW_SIZE / 2,
            PLAYER_DRAW_SIZE,
            PLAYER_DRAW_SIZE,
          );
          ctx.globalAlpha = 1;
        }

        // Gold glow when empowered (pulsing opacity for visibility)
        if (timestamp < p.empoweredUntil) {
          const pulse = 0.25 + 0.2 * Math.sin(timestamp * 0.008);
          const empoweredSprite = getTintedOverlaySprite(
            spriteKey,
            sprite,
            EMPOWER_GLOW_COLOR,
          );
          ctx.globalAlpha = pulse;
          ctx.drawImage(
            empoweredSprite,
            -PLAYER_DRAW_SIZE / 2,
            -PLAYER_DRAW_SIZE / 2,
            PLAYER_DRAW_SIZE,
            PLAYER_DRAW_SIZE,
          );
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      };

      // KO sprites are drawn first so they remain visually underneath active players.
      for (const p of knockedOut) {
        drawPlayer(p);
      }

      // Draw active team sprites on top.
      for (const p of activeTeam) {
        drawPlayer(p);
      }

      // === KO Countdown Overlay ===
      if (koRef.current.active) {
        const remaining = Math.max(0, koRef.current.endTime - timestamp);
        const seconds = Math.ceil(remaining / 1000);
        const koFont = "'Press Start 2P', monospace";

        // Semi-transparent dark overlay
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

        // "KO!" text
        ctx.font = `bold 80px ${koFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
        ctx.strokeText("KO!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 50);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("KO!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 50);

        // Countdown number
        ctx.font = `bold 120px ${koFont}`;
        ctx.strokeText(String(seconds), FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 60);
        ctx.fillStyle =
          koRef.current.winner === "team1" ? TEAM1_COLOR : TEAM2_COLOR;
        ctx.fillText(String(seconds), FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 60);

        ctx.restore();
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [
    host,
    actions,
    getTintedOverlaySprite,
    matchPhase,
    slotParticipants,
    participantBySlot,
  ]);

  return (
    <div className="host-view-shell">
      <div className="fixed top-4 right-4 z-70">
        <HostMuteButton
          muted={audioMuted}
          onToggle={() => setAudioMuted((previous) => !previous)}
          className="pixel-font h-10 rounded-none border-2 border-zinc-600 bg-zinc-900/85 text-zinc-100 hover:bg-zinc-800"
          labelClassName="tracking-[0.14em]"
        />
      </div>

      <div
        className="relative flex min-h-screen flex-col items-center justify-center p-4"
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
      </div>

      {matchPhase === "lobby" ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-2 sm:p-3 md:p-4">
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
                        className="pt-1"
                        inputClassName="pixel-font border-2 border-zinc-600 bg-black/80 text-xs text-zinc-100"
                        buttonClassName="border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      />
                    </div>

                    <div className="mt-2 min-h-0 flex-1 rounded-none border-4 border-zinc-700 bg-zinc-900/45 p-3 md:mt-3">
                      <div className="grid h-full min-h-0 gap-3 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                        <div className="flex flex-col items-center border-zinc-700 pb-3 md:border-r-2 md:pr-3 md:pb-0">
                          <p className="text-[10px] tracking-[0.2em] text-zinc-400 uppercase">
                            Scan To Join
                          </p>
                          <div className="mt-2 flex w-full flex-1 items-start justify-center">
                            {hostLobbyShell.joinUrlValue ? (
                              <RoomQrCode
                                value={hostLobbyShell.joinUrlValue}
                                size={448}
                                padding={1}
                                foregroundColor="#ffffff"
                                backgroundColor="#00000000"
                                className="mx-auto h-auto w-full max-w-52 sm:max-w-60 md:max-w-88 xl:max-w-md"
                                style={{
                                  width: "100%",
                                  height: "auto",
                                  aspectRatio: "1 / 1",
                                }}
                                alt={`Join room ${host.roomId}`}
                              />
                            ) : (
                              <div className="flex h-full min-h-40 w-full items-center justify-center px-3 text-center">
                                <span className="text-xs text-zinc-400">
                                  Generating QR code…
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex min-h-0 flex-col md:pl-1">
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
                                    onClick={() => copyPlayerId(participant.id)}
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
          </div>
        </div>
      ) : null}

      {matchPhase === "ended" ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-3 sm:p-4">
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
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/45">
          <div className="pixel-font rounded-none border-4 border-zinc-600 bg-zinc-900/90 px-6 py-4 text-center text-zinc-100">
            <p className="text-sm tracking-[0.18em] uppercase">Match Paused</p>
            <p className="mt-2 text-xs text-zinc-300">
              Waiting for runtime reconnect...
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
