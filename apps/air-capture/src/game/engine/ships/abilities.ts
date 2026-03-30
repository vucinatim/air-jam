import type { AbilityData, AbilityId } from "../../abilities-store";

export interface ShipAbilityFeedback {
  sound: "speed_boost" | "health_pack" | "rocket_launch";
  haptic: "medium" | "success" | "heavy";
}

const SHIP_ABILITY_FEEDBACK: Partial<Record<AbilityId, ShipAbilityFeedback>> = {
  speed_boost: {
    sound: "speed_boost",
    haptic: "medium",
  },
  health_pack: {
    sound: "health_pack",
    haptic: "success",
  },
  rocket: {
    sound: "rocket_launch",
    haptic: "heavy",
  },
};

export function shouldActivateShipAbility(params: {
  abilityPressed: boolean;
  currentAbility: AbilityData | null;
}): boolean {
  const { abilityPressed, currentAbility } = params;
  return Boolean(
    abilityPressed &&
      currentAbility &&
      currentAbility.startTime === null,
  );
}

export function getShipAbilityFeedback(
  abilityId: AbilityId,
): ShipAbilityFeedback | null {
  return SHIP_ABILITY_FEEDBACK[abilityId] ?? null;
}

export function stepShipAbility(params: {
  controllerId: string;
  abilityPressed: boolean;
  currentAbility: AbilityData | null;
  delta: number;
  activateAbility(controllerId: string, abilityId: AbilityId): void;
  updateActiveAbilities(controllerId: string, delta: number): void;
  playSound(sound: ShipAbilityFeedback["sound"]): void;
  sendHaptic(pattern: ShipAbilityFeedback["haptic"], controllerId: string): void;
  log?(message: string): void;
}) {
  const {
    controllerId,
    abilityPressed,
    currentAbility,
    delta,
    activateAbility,
    updateActiveAbilities,
    playSound,
    sendHaptic,
    log,
  } = params;

  if (
    shouldActivateShipAbility({
      abilityPressed,
      currentAbility,
    }) &&
    currentAbility
  ) {
    activateAbility(controllerId, currentAbility.id);

    const feedback = getShipAbilityFeedback(currentAbility.id);
    if (feedback) {
      playSound(feedback.sound);
      sendHaptic(feedback.haptic, controllerId);
    }

    log?.(`[SHIP] Ability activated for ${controllerId}, ability: ${currentAbility.id}`);
  }

  updateActiveAbilities(controllerId, delta);
}
