import type { AbilityId } from "../../abilities/definitions";
import { RocketModel } from "../models/rocket-model";

/** Must match where the simulation launches a rocket from the ship. */
const ROCKET_UPWARD_OFFSET = 0.9;

/** What an equipped, unused ability looks like on a ship. */
export function AbilityVisual({ abilityId }: { abilityId: AbilityId }) {
  if (abilityId !== "rocket") return null;
  return (
    <group position={[0, ROCKET_UPWARD_OFFSET, 0]}>
      <RocketModel showParticles={false} horizontal={true} />
    </group>
  );
}
