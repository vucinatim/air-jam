import {
  DEFAULT_ARENA_COLORS,
  EMPOWER_GLOW_COLOR,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  HIT_FLASH_TINT_ALPHA,
  IDLE_FRAME_MAX_MS,
  IDLE_FRAME_MIN_MS,
  PLAYER_DRAW_SIZE,
  PLAYER_KEYS,
  PLAYER_SIZE,
  RING_PADDING,
  ROPE_GAP,
  TEAM1_COLOR,
  TEAM2_COLOR,
} from "./constants";
import type {
  ArenaColors,
  KoState,
  PlayerKey,
  RuntimePlayerState,
  SlotParticipant,
  SpriteKey,
} from "./types";

const readCssVar = (
  styles: CSSStyleDeclaration,
  variableName: string,
  fallback: string,
) => {
  const value = styles.getPropertyValue(variableName).trim();
  return value || fallback;
};

export const createArenaColors = (styles: CSSStyleDeclaration): ArenaColors => ({
  ringMat: readCssVar(styles, "--ring-mat-color", DEFAULT_ARENA_COLORS.ringMat),
  ringMarkings: readCssVar(
    styles,
    "--ring-markings-color",
    DEFAULT_ARENA_COLORS.ringMarkings,
  ),
  ringRopePrimary: readCssVar(
    styles,
    "--ring-rope-primary-color",
    DEFAULT_ARENA_COLORS.ringRopePrimary,
  ),
  ringRopeSecondary: readCssVar(
    styles,
    "--ring-rope-secondary-color",
    DEFAULT_ARENA_COLORS.ringRopeSecondary,
  ),
  cornerRed: readCssVar(
    styles,
    "--ring-corner-red-color",
    DEFAULT_ARENA_COLORS.cornerRed,
  ),
  cornerBlue: readCssVar(
    styles,
    "--ring-corner-blue-color",
    DEFAULT_ARENA_COLORS.cornerBlue,
  ),
  postBody: readCssVar(
    styles,
    "--ring-post-body-color",
    DEFAULT_ARENA_COLORS.postBody,
  ),
  postTop: readCssVar(
    styles,
    "--ring-post-top-color",
    DEFAULT_ARENA_COLORS.postTop,
  ),
});

export const setupCanvas = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = FIELD_WIDTH * dpr;
  canvas.height = FIELD_HEIGHT * dpr;
  canvas.style.width = `${FIELD_WIDTH}px`;
  canvas.style.height = `${FIELD_HEIGHT}px`;
  context.scale(dpr, dpr);
};

type ActivePlayer = {
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
};

type DrawFrameOptions = {
  context: CanvasRenderingContext2D;
  now: number;
  timestamp: number;
  state: RuntimePlayerState;
  participantBySlot: Partial<Record<PlayerKey, SlotParticipant>>;
  sprites: Record<SpriteKey, HTMLCanvasElement | null>;
  getTintedOverlaySprite: (
    spriteKey: SpriteKey,
    sprite: HTMLCanvasElement,
    color: string,
  ) => HTMLCanvasElement;
  arenaColors: ArenaColors;
  koState: KoState;
};

export const drawFrame = ({
  context,
  now,
  timestamp,
  state,
  participantBySlot,
  sprites,
  getTintedOverlaySprite,
  arenaColors,
  koState,
}: DrawFrameOptions) => {
  context.fillStyle = arenaColors.ringMat;
  context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  const ringX = RING_PADDING;
  const ringY = RING_PADDING;
  const ringSize = FIELD_WIDTH - RING_PADDING * 2;

  context.fillStyle = arenaColors.ringMat;
  context.fillRect(ringX, ringY, ringSize, ringSize);

  context.strokeStyle = arenaColors.ringMarkings;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 48, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(FIELD_WIDTH / 2, ringY + 16);
  context.lineTo(FIELD_WIDTH / 2, ringY + ringSize - 16);
  context.moveTo(ringX + 16, FIELD_HEIGHT / 2);
  context.lineTo(ringX + ringSize - 16, FIELD_HEIGHT / 2);
  context.stroke();

  for (let index = 0; index < 3; index += 1) {
    const ropeInset = index * ROPE_GAP;
    context.strokeStyle =
      index === 1 ? arenaColors.ringRopePrimary : arenaColors.ringRopeSecondary;
    context.lineWidth = 4;
    context.strokeRect(
      ringX - ropeInset,
      ringY - ropeInset,
      ringSize + ropeInset * 2,
      ringSize + ropeInset * 2,
    );
  }

  context.fillStyle = arenaColors.cornerRed;
  context.fillRect(ringX - 18, ringY - 18, 36, 36);
  context.fillRect(ringX + ringSize - 18, ringY + ringSize - 18, 36, 36);
  context.fillStyle = arenaColors.cornerBlue;
  context.fillRect(ringX + ringSize - 18, ringY - 18, 36, 36);
  context.fillRect(ringX - 18, ringY + ringSize - 18, 36, 36);

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
    context.fillStyle = arenaColors.postTop;
    context.beginPath();
    context.arc(x, y, postRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = arenaColors.postBody;
    context.lineWidth = 2;
    context.stroke();
  });

  const activePlayers: ActivePlayer[] = [];
  for (const key of PLAYER_KEYS) {
    if (!participantBySlot[key]) {
      continue;
    }

    const playerState = state[key];
    if (now >= playerState.idleNextSwap) {
      playerState.idleLeft = !playerState.idleLeft;
      playerState.idleNextSwap =
        now +
        IDLE_FRAME_MIN_MS +
        Math.random() * (IDLE_FRAME_MAX_MS - IDLE_FRAME_MIN_MS);
    }

    activePlayers.push({
      key,
      team: key.startsWith("player1") ? "team1" : "team2",
      cx: playerState.x + PLAYER_SIZE / 2,
      cy: playerState.y + PLAYER_SIZE / 2,
      punchingLeft: playerState.punchingLeft,
      punchingRight: playerState.punchingRight,
      defending: playerState.defending,
      hitFlashEnd: playerState.hitFlashEnd,
      idleLeft: playerState.idleLeft,
      empoweredUntil: playerState.empoweredUntil,
    });
  }

  const koLoserTeam =
    koState.active && koState.winner
      ? koState.winner === "team1"
        ? "team2"
        : "team1"
      : null;

  const knockedOutPlayers: ActivePlayer[] = [];
  const standingPlayers: ActivePlayer[] = [];

  activePlayers.forEach((player) => {
    if (koLoserTeam && player.team === koLoserTeam) {
      knockedOutPlayers.push(player);
      return;
    }

    standingPlayers.push(player);
  });

  const drawPlayer = (player: ActivePlayer) => {
    const teamPrefix = player.team === "team1" ? "team1" : "team2";
    const defaultSpriteKey = player.idleLeft
      ? (`${teamPrefix}LeftShort` as const)
      : (`${teamPrefix}RightShort` as const);
    const spriteKey =
      koLoserTeam === player.team
        ? (`${teamPrefix}End` as const)
        : player.punchingLeft
          ? (`${teamPrefix}LeftExtended` as const)
          : player.punchingRight
            ? (`${teamPrefix}RightExtended` as const)
            : player.defending
              ? (`${teamPrefix}Defend` as const)
              : defaultSpriteKey;
    const sprite =
      sprites[spriteKey] ?? sprites[defaultSpriteKey];

    if (!sprite) {
      return;
    }

    let angle = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    activePlayers.forEach((other) => {
      if (other.team === player.team) {
        return;
      }

      const dx = other.cx - player.cx;
      const dy = other.cy - player.cy;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        angle = Math.atan2(dy, dx) + Math.PI / 2;
      }
    });

    context.save();
    context.translate(player.cx, player.cy);
    context.rotate(angle);
    context.drawImage(
      sprite,
      -PLAYER_DRAW_SIZE / 2,
      -PLAYER_DRAW_SIZE / 2,
      PLAYER_DRAW_SIZE,
      PLAYER_DRAW_SIZE,
    );

    if (timestamp < player.hitFlashEnd) {
      const hitFlashColor =
        player.team === "team1" ? TEAM2_COLOR : TEAM1_COLOR;
      const hitFlashSprite = getTintedOverlaySprite(
        spriteKey,
        sprite,
        hitFlashColor,
      );
      context.globalAlpha = HIT_FLASH_TINT_ALPHA;
      context.drawImage(
        hitFlashSprite,
        -PLAYER_DRAW_SIZE / 2,
        -PLAYER_DRAW_SIZE / 2,
        PLAYER_DRAW_SIZE,
        PLAYER_DRAW_SIZE,
      );
      context.globalAlpha = 1;
    }

    if (timestamp < player.empoweredUntil) {
      const pulse = 0.25 + 0.2 * Math.sin(timestamp * 0.008);
      const empoweredSprite = getTintedOverlaySprite(
        spriteKey,
        sprite,
        EMPOWER_GLOW_COLOR,
      );
      context.globalAlpha = pulse;
      context.drawImage(
        empoweredSprite,
        -PLAYER_DRAW_SIZE / 2,
        -PLAYER_DRAW_SIZE / 2,
        PLAYER_DRAW_SIZE,
        PLAYER_DRAW_SIZE,
      );
      context.globalAlpha = 1;
    }

    context.restore();
  };

  knockedOutPlayers.forEach(drawPlayer);
  standingPlayers.forEach(drawPlayer);

  if (!koState.active) {
    return;
  }

  const remaining = Math.max(0, koState.endTime - timestamp);
  const seconds = Math.ceil(remaining / 1000);
  const koFont = "'Press Start 2P', monospace";

  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.55)";
  context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  context.font = `bold 80px ${koFont}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 4;
  context.strokeStyle = "rgba(0, 0, 0, 0.7)";
  context.strokeText("KO!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 50);
  context.fillStyle = "#ffffff";
  context.fillText("KO!", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 50);

  context.font = `bold 120px ${koFont}`;
  context.strokeText(String(seconds), FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 60);
  context.fillStyle = koState.winner === "team1" ? TEAM1_COLOR : TEAM2_COLOR;
  context.fillText(String(seconds), FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 60);

  context.restore();
};
