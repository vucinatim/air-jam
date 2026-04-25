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
  wasAbilityPressed: boolean;
  currentAbility: AbilityData | null;
}): boolean {
  const { abilityPressed, wasAbilityPressed, currentAbility } = params;
  return Boolean(
    abilityPressed &&
    !wasAbilityPressed &&
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
  wasAbilityPressed: boolean;
  currentAbility: AbilityData | null;
  delta: number;
  activateAbility(controllerId: string, abilityId: AbilityId): void;
  getActiveRocketId(controllerId: string): string | null;
  requestDetonateRocket(id: string): void;
  updateActiveAbilities(controllerId: string, delta: number): void;
  playSound(sound: ShipAbilityFeedback["sound"]): void;
  sendHaptic(
    pattern: ShipAbilityFeedback["haptic"],
    controllerId: string,
  ): void;
  log?(message: string): void;
}) {
  const {
    controllerId,
    abilityPressed,
    wasAbilityPressed,
    currentAbility,
    delta,
    activateAbility,
    getActiveRocketId,
    requestDetonateRocket,
    updateActiveAbilities,
    playSound,
    sendHaptic,
    log,
  } = params;

  if (
    shouldActivateShipAbility({
      abilityPressed,
      wasAbilityPressed,
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

    log?.(
      `[SHIP] Ability activated for ${controllerId}, ability: ${currentAbility.id}`,
    );
  } else if (abilityPressed && !wasAbilityPressed) {
    const activeRocketId = getActiveRocketId(controllerId);
    if (activeRocketId) {
      requestDetonateRocket(activeRocketId);
      log?.(`[SHIP] Rocket manually detonated for ${controllerId}`);
    }
  }

  updateActiveAbilities(controllerId, delta);
}
