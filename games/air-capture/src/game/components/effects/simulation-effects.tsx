import { useSimulationEvents } from "@air-jam/sdk";
import { useState } from "react";
import { Vector3 } from "three";
import type { AbilityId } from "../../abilities/definitions";
import type { AirCaptureEvent } from "../../simulation/state";
import { useDecalsStore } from "../../stores/world/decals-store";
import {
  COLLECTIBLE_BURST_SECONDS,
  CollectibleBurst,
} from "../entities/collectible";
import { RocketExplosion } from "./rocket-explosion";
import { ShipExplosion } from "./ship-explosion";

type Effect =
  | { id: number; kind: "ship"; position: [number, number, number] }
  | { id: number; kind: "rocket"; position: [number, number, number] }
  | {
      id: number;
      kind: "collectible";
      position: [number, number, number];
      abilityId: AbilityId;
    };

let nextEffectId = 0;

/** The explosions, bursts and scorch marks the simulation's events leave. */
export function SimulationEffects() {
  const [effects, setEffects] = useState<Effect[]>([]);
  const addDecal = useDecalsStore((state) => state.addDecal);
  const remove = (id: number) =>
    setEffects((current) => current.filter((effect) => effect.id !== id));

  useSimulationEvents<AirCaptureEvent>((event) => {
    if (event.type === "impact") {
      addDecal({
        position: event.position,
        normal: new Vector3(...event.normal),
      });
      return;
    }
    const id = (nextEffectId += 1);
    if (event.type === "ship-destroyed")
      setEffects((current) => [
        ...current,
        { id, kind: "ship", position: event.position },
      ]);
    else if (event.type === "rocket-exploded")
      setEffects((current) => [
        ...current,
        { id, kind: "rocket", position: event.position },
      ]);
    else if (event.type === "collectible-taken") {
      setEffects((current) => [
        ...current,
        {
          id,
          kind: "collectible",
          position: event.position,
          abilityId: event.abilityId,
        },
      ]);
      window.setTimeout(() => remove(id), COLLECTIBLE_BURST_SECONDS * 1000);
    }
  });

  return (
    <>
      {effects.map((effect) =>
        effect.kind === "ship" ? (
          <ShipExplosion
            key={effect.id}
            position={effect.position}
            onComplete={() => remove(effect.id)}
          />
        ) : effect.kind === "rocket" ? (
          <RocketExplosion
            key={effect.id}
            position={effect.position}
            onComplete={() => remove(effect.id)}
          />
        ) : (
          <CollectibleBurst
            key={effect.id}
            position={effect.position}
            abilityId={effect.abilityId}
          />
        ),
      )}
    </>
  );
}
