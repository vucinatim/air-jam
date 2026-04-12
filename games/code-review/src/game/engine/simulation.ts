import type { Team } from "../domain/team-assignments";
import type { GameInput } from "../input";
import { PUNCH_COOLDOWN_MS, PUNCH_DURATION_MS } from "../input";
import {
  ACCELERATION,
  BOT_APPROACH_INTENT,
  BOT_DEFEND_DISTANCE,
  BOT_DEFEND_WINDOW_MS,
  BOT_FOLLOW_DISTANCE,
  BOT_PUNCH_DISTANCE,
  BOT_PUNCH_WINDOW_MS,
  BOT_RETREAT_DISTANCE,
  BOT_STRAFE_DISTANCE,
  BOT_STRAFE_INTENT,
  COAST_FRICTION,
  COLLISION_PUSH,
  DEFEND_ACCELERATION_MULTIPLIER,
  DEFEND_DAMAGE_MULTIPLIER,
  DEFEND_KNOCKBACK_MULTIPLIER,
  EMPOWER_DAMAGE_MULTIPLIER,
  EMPOWER_DURATION_MS,
  EMPOWER_KNOCKBACK_MULTIPLIER,
  HIT_FLASH_MS,
  KNOCKBACK_FRICTION,
  KO_COUNTDOWN_MS,
  MAX_VELOCITY,
  MOVE_FRICTION,
  PLAYER_SIZE,
  PUNCH_DAMAGE,
  PUNCH_DISPLACEMENT,
  PUNCH_KNOCKBACK_FRAMES,
  PUNCH_KNOCKBACK_VELOCITY,
  PUNCH_REACH,
  PUNCH_RECOIL,
  RING_MAX_X,
  RING_MAX_Y,
  RING_MIN_X,
  RING_MIN_Y,
  VELOCITY_EPSILON,
} from "./constants";
import {
  createHpState,
  createKoState,
  createRuntimePlayerState,
} from "./runtime-state";
import type {
  HpState,
  PlayerKey,
  RuntimePlayerState,
  SlotParticipant,
} from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getPlayerCenter = (
  playerState: Pick<RuntimePlayerState[PlayerKey], "x" | "y">,
) => ({
  x: playerState.x + PLAYER_SIZE / 2,
  y: playerState.y + PLAYER_SIZE / 2,
});

const getCenterDelta = (
  leftState: Pick<RuntimePlayerState[PlayerKey], "x" | "y">,
  rightState: Pick<RuntimePlayerState[PlayerKey], "x" | "y">,
) => {
  const leftCenter = getPlayerCenter(leftState);
  const rightCenter = getPlayerCenter(rightState);
  const dx = rightCenter.x - leftCenter.x;
  const dy = rightCenter.y - leftCenter.y;

  return {
    dx,
    dy,
    distance: Math.hypot(dx, dy),
  };
};

const hasMovementInput = (input: Pick<GameInput, "horizontal" | "vertical">) =>
  Math.abs(input.horizontal) > 0.01 || Math.abs(input.vertical) > 0.01;

const getAppliedFriction = (
  input: Pick<GameInput, "horizontal" | "vertical">,
  inKnockback: boolean,
) => {
  if (inKnockback) {
    return KNOCKBACK_FRICTION;
  }

  return hasMovementInput(input) ? MOVE_FRICTION : COAST_FRICTION;
};

const createBotInput = (
  participant: SlotParticipant,
  participants: SlotParticipant[],
  state: RuntimePlayerState,
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
    const { distance } = getCenterDelta(selfState, enemyState);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = enemy;
    }
  });

  const target = state[nearestEnemy.slotKey];
  const { dx, dy, distance: rawDistance } = getCenterDelta(selfState, target);
  const distance = Math.max(rawDistance, 1);
  const towardX = dx / distance;
  const towardY = dy / distance;
  const pulseStep = Math.floor(timestamp / 220);
  const punchStep = Math.floor(timestamp / BOT_PUNCH_WINDOW_MS);
  const defendStep = Math.floor(timestamp / BOT_DEFEND_WINDOW_MS);
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
    horizontal = towardX * BOT_APPROACH_INTENT;
    vertical = towardY * BOT_APPROACH_INTENT;
  }

  if (
    nearestDistance <= BOT_STRAFE_DISTANCE &&
    nearestDistance >= BOT_RETREAT_DISTANCE
  ) {
    horizontal += towardY * BOT_STRAFE_INTENT * strafeDirection;
    vertical += -towardX * BOT_STRAFE_INTENT * strafeDirection;
  }

  horizontal = clamp(horizontal, -1, 1);
  vertical = clamp(vertical, -1, 1);

  const enemyPunching = target.punchingLeft || target.punchingRight;
  const defend =
    nearestDistance <= BOT_DEFEND_DISTANCE &&
    enemyPunching &&
    (defendStep + participant.id.length) % 2 === 0;
  const punchWindowOpen = (punchStep + participant.slotKey.length) % 3 === 0;
  const pressureGuardOpen =
    target.defending &&
    (punchStep + participant.id.length + nearestEnemy.id.length) % 5 === 0;
  const canPunch =
    nearestDistance <= BOT_PUNCH_DISTANCE &&
    !defend &&
    target.knockbackFrames === 0 &&
    (punchWindowOpen || pressureGuardOpen);
  const prefersLeftPunch = (pulseStep + participant.id.length) % 2 === 0;

  return {
    vertical,
    horizontal,
    leftPunch: canPunch && prefersLeftPunch,
    rightPunch: canPunch && !prefersLeftPunch,
    defend,
  };
};

type StepMatchFrameOptions = {
  state: RuntimePlayerState;
  participants: SlotParticipant[];
  participantBySlot: Partial<Record<PlayerKey, SlotParticipant>>;
  hpState: HpState;
  koState: {
    active: boolean;
    winner: Team | null;
    endTime: number;
  };
  dt: number;
  timestamp: number;
  getInput: (controllerId: string) => GameInput | undefined;
  onMiss: () => void;
  onHit: () => void;
  onBell: () => void;
  onScore: (team: Team) => void;
  onHeavyHit: (controllerId: string) => void;
};

export const stepMatchFrame = ({
  state,
  participants,
  participantBySlot,
  hpState,
  koState,
  dt,
  timestamp,
  getInput,
  onMiss,
  onHit,
  onBell,
  onScore,
  onHeavyHit,
}: StepMatchFrameOptions) => {
  if (koState.active) {
    if (timestamp >= koState.endTime) {
      if (koState.winner) {
        onScore(koState.winner);
      }

      Object.assign(state, createRuntimePlayerState());
      Object.assign(hpState, createHpState());
      Object.assign(koState, createKoState());
      onBell();
    }

    return;
  }

  let hitSoundPlayedThisFrame = false;

  participants.forEach((participant) => {
    const input = participant.isBot
      ? createBotInput(participant, participants, state, timestamp)
      : getInput(participant.id);

    if (!input) {
      return;
    }

    const playerState = state[participant.slotKey];
    playerState.cooldownLeft = Math.max(0, playerState.cooldownLeft - dt);
    playerState.cooldownRight = Math.max(0, playerState.cooldownRight - dt);

    if (playerState.punchingLeft && timestamp >= playerState.punchEndLeft) {
      if (!playerState.punchLandedLeft) {
        onMiss();
      }
      playerState.punchingLeft = false;
      playerState.punchLandedLeft = false;
    }

    if (playerState.punchingRight && timestamp >= playerState.punchEndRight) {
      if (!playerState.punchLandedRight) {
        onMiss();
      }
      playerState.punchingRight = false;
      playerState.punchLandedRight = false;
    }

    if (!playerState.punchingLeft && !playerState.punchingRight) {
      playerState.punchEmpowered = false;
    }

    playerState.defending = input.defend;

    if (!playerState.defending) {
      if (input.leftPunch && playerState.cooldownLeft <= 0) {
        playerState.punchingLeft = true;
        playerState.punchLandedLeft = false;
        playerState.cooldownLeft = PUNCH_COOLDOWN_MS;
        playerState.punchEndLeft = timestamp + PUNCH_DURATION_MS;
        if (timestamp < playerState.empoweredUntil) {
          playerState.punchEmpowered = true;
          playerState.empoweredUntil = 0;
        }
      }

      if (input.rightPunch && playerState.cooldownRight <= 0) {
        playerState.punchingRight = true;
        playerState.punchLandedRight = false;
        playerState.cooldownRight = PUNCH_COOLDOWN_MS;
        playerState.punchEndRight = timestamp + PUNCH_DURATION_MS;
        if (timestamp < playerState.empoweredUntil) {
          playerState.punchEmpowered = true;
          playerState.empoweredUntil = 0;
        }
      }
    }

    if (
      playerState.empoweredUntil > 0 &&
      timestamp >= playerState.empoweredUntil
    ) {
      playerState.empoweredUntil = 0;
    }

    const acceleration = playerState.defending
      ? ACCELERATION * DEFEND_ACCELERATION_MULTIPLIER
      : ACCELERATION;
    const appliedFriction = getAppliedFriction(
      input,
      playerState.knockbackFrames > 0,
    );

    if (playerState.knockbackFrames > 0) {
      playerState.vx =
        (playerState.vx + input.horizontal * acceleration) * appliedFriction;
      playerState.vy =
        (playerState.vy + input.vertical * acceleration) * appliedFriction;
      playerState.knockbackFrames -= 1;
    } else {
      playerState.vx = clamp(
        (playerState.vx + input.horizontal * acceleration) * appliedFriction,
        -MAX_VELOCITY,
        MAX_VELOCITY,
      );
      playerState.vy = clamp(
        (playerState.vy + input.vertical * acceleration) * appliedFriction,
        -MAX_VELOCITY,
        MAX_VELOCITY,
      );
    }

    if (Math.abs(playerState.vx) < VELOCITY_EPSILON) {
      playerState.vx = 0;
    }
    if (Math.abs(playerState.vy) < VELOCITY_EPSILON) {
      playerState.vy = 0;
    }

    playerState.x = clamp(
      playerState.x + playerState.vx,
      RING_MIN_X,
      RING_MAX_X,
    );
    playerState.y = clamp(
      playerState.y + playerState.vy,
      RING_MIN_Y,
      RING_MAX_Y,
    );
  });

  const activePlayers = participants.map((participant) => {
    const playerState = state[participant.slotKey];
    const isPunching =
      (playerState.punchingLeft && !playerState.punchLandedLeft) ||
      (playerState.punchingRight && !playerState.punchLandedRight);

    return {
      participant,
      playerState,
      isPunching,
    };
  });

  for (let leftIndex = 0; leftIndex < activePlayers.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < activePlayers.length;
      rightIndex += 1
    ) {
      const left = activePlayers[leftIndex];
      const right = activePlayers[rightIndex];
      const { dx, dy, distance } = getCenterDelta(
        left.playerState,
        right.playerState,
      );
      const safeDistance = distance || 1;

      const leftIsPunchingRight =
        left.isPunching &&
        left.participant.team !== right.participant.team &&
        distance <= PUNCH_REACH;
      const rightIsPunchingLeft =
        right.isPunching &&
        right.participant.team !== left.participant.team &&
        distance <= PUNCH_REACH;

      if (leftIsPunchingRight || rightIsPunchingLeft) {
        const nx = dx / safeDistance;
        const ny = dy / safeDistance;

        if (leftIsPunchingRight) {
          const victimDefending = right.playerState.defending;
          const knockbackMultiplier =
            (victimDefending ? DEFEND_KNOCKBACK_MULTIPLIER : 1) *
            (left.playerState.punchEmpowered
              ? EMPOWER_KNOCKBACK_MULTIPLIER
              : 1);
          const damageMultiplier =
            (victimDefending ? DEFEND_DAMAGE_MULTIPLIER : 1) *
            (left.playerState.punchEmpowered ? EMPOWER_DAMAGE_MULTIPLIER : 1);

          right.playerState.x += nx * PUNCH_DISPLACEMENT * knockbackMultiplier;
          right.playerState.y += ny * PUNCH_DISPLACEMENT * knockbackMultiplier;
          right.playerState.vx =
            nx * PUNCH_KNOCKBACK_VELOCITY * knockbackMultiplier;
          right.playerState.vy =
            ny * PUNCH_KNOCKBACK_VELOCITY * knockbackMultiplier;
          right.playerState.knockbackFrames = PUNCH_KNOCKBACK_FRAMES;
          left.playerState.vx -= nx * PUNCH_RECOIL;
          left.playerState.vy -= ny * PUNCH_RECOIL;

          hpState[right.participant.team] = Math.max(
            0,
            hpState[right.participant.team] - PUNCH_DAMAGE * damageMultiplier,
          );
          right.playerState.hitFlashEnd = timestamp + HIT_FLASH_MS;

          if (victimDefending) {
            right.playerState.empoweredUntil = timestamp + EMPOWER_DURATION_MS;
          }

          if (left.playerState.punchingLeft) {
            left.playerState.punchLandedLeft = true;
          }
          if (left.playerState.punchingRight) {
            left.playerState.punchLandedRight = true;
          }

          if (!hitSoundPlayedThisFrame) {
            onHit();
            hitSoundPlayedThisFrame = true;
          }

          if (!right.participant.isBot) {
            onHeavyHit(right.participant.id);
          }
        }

        if (rightIsPunchingLeft) {
          const victimDefending = left.playerState.defending;
          const knockbackMultiplier =
            (victimDefending ? DEFEND_KNOCKBACK_MULTIPLIER : 1) *
            (right.playerState.punchEmpowered
              ? EMPOWER_KNOCKBACK_MULTIPLIER
              : 1);
          const damageMultiplier =
            (victimDefending ? DEFEND_DAMAGE_MULTIPLIER : 1) *
            (right.playerState.punchEmpowered ? EMPOWER_DAMAGE_MULTIPLIER : 1);

          left.playerState.x -= nx * PUNCH_DISPLACEMENT * knockbackMultiplier;
          left.playerState.y -= ny * PUNCH_DISPLACEMENT * knockbackMultiplier;
          left.playerState.vx =
            -nx * PUNCH_KNOCKBACK_VELOCITY * knockbackMultiplier;
          left.playerState.vy =
            -ny * PUNCH_KNOCKBACK_VELOCITY * knockbackMultiplier;
          left.playerState.knockbackFrames = PUNCH_KNOCKBACK_FRAMES;
          right.playerState.vx += nx * PUNCH_RECOIL;
          right.playerState.vy += ny * PUNCH_RECOIL;

          hpState[left.participant.team] = Math.max(
            0,
            hpState[left.participant.team] - PUNCH_DAMAGE * damageMultiplier,
          );
          left.playerState.hitFlashEnd = timestamp + HIT_FLASH_MS;

          if (victimDefending) {
            left.playerState.empoweredUntil = timestamp + EMPOWER_DURATION_MS;
          }

          if (right.playerState.punchingLeft) {
            right.playerState.punchLandedLeft = true;
          }
          if (right.playerState.punchingRight) {
            right.playerState.punchLandedRight = true;
          }

          if (!hitSoundPlayedThisFrame) {
            onHit();
            hitSoundPlayedThisFrame = true;
          }

          if (!left.participant.isBot) {
            onHeavyHit(left.participant.id);
          }
        }

        continue;
      }

      const bodyOverlapX =
        Math.min(
          left.playerState.x + PLAYER_SIZE,
          right.playerState.x + PLAYER_SIZE,
        ) - Math.max(left.playerState.x, right.playerState.x);
      const bodyOverlapY =
        Math.min(
          left.playerState.y + PLAYER_SIZE,
          right.playerState.y + PLAYER_SIZE,
        ) - Math.max(left.playerState.y, right.playerState.y);

      if (bodyOverlapX <= 0 || bodyOverlapY <= 0) {
        continue;
      }

      if (bodyOverlapX < bodyOverlapY) {
        const sign =
          left.playerState.x + PLAYER_SIZE / 2 <
          right.playerState.x + PLAYER_SIZE / 2
            ? -1
            : 1;
        const half = bodyOverlapX / 2;
        left.playerState.x += sign * half;
        right.playerState.x -= sign * half;
        left.playerState.vx += sign * COLLISION_PUSH;
        right.playerState.vx -= sign * COLLISION_PUSH;
      } else {
        const sign =
          left.playerState.y + PLAYER_SIZE / 2 <
          right.playerState.y + PLAYER_SIZE / 2
            ? -1
            : 1;
        const half = bodyOverlapY / 2;
        left.playerState.y += sign * half;
        right.playerState.y -= sign * half;
        left.playerState.vy += sign * COLLISION_PUSH;
        right.playerState.vy -= sign * COLLISION_PUSH;
      }
    }
  }

  activePlayers.forEach(({ playerState }) => {
    playerState.x = clamp(playerState.x, RING_MIN_X, RING_MAX_X);
    playerState.y = clamp(playerState.y, RING_MIN_Y, RING_MAX_Y);
  });

  if (hpState.team1 <= 0 || hpState.team2 <= 0) {
    koState.active = true;
    koState.winner = hpState.team1 <= 0 ? "team2" : "team1";
    koState.endTime = timestamp + KO_COUNTDOWN_MS;
    onBell();
  }
};
