import {
  captureAgentCanvas,
  useAirJamSettings,
  useHostAgentCapture,
  useSendSignal,
  useSimulationEvents,
  useSimulationFrame,
} from "@air-jam/sdk";
import { useRef, useState, type MutableRefObject } from "react";
import { codeReviewSettings } from "../../game/contracts/settings";
import type { CodeReviewSfxId } from "../../game/contracts/sounds";
import type {
  CodeReviewSimulationEvent,
  CodeReviewSimulationState,
} from "../../game/engine/code-review-simulation";
import { drawFrame } from "../../game/engine/render";
import type {
  ArenaColors,
  PlayerKey,
  SlotParticipant,
  SpriteKey,
} from "../../game/engine/types";

/** Draws the fight the simulation plays and turns its events into feedback. */
export const useCodeReviewMatchView = ({
  participantBySlot,
  spritesRef,
  getContext,
  getArenaColors,
  getTintedOverlaySprite,
  playSfxFromRef,
}: {
  participantBySlot: Partial<Record<PlayerKey, SlotParticipant>>;
  spritesRef: MutableRefObject<Record<SpriteKey, HTMLCanvasElement | null>>;
  getContext: () => CanvasRenderingContext2D | null;
  getArenaColors: () => ArenaColors | null;
  getTintedOverlaySprite: (
    spriteKey: SpriteKey,
    sprite: HTMLCanvasElement,
    color: string,
  ) => HTMLCanvasElement;
  playSfxFromRef: (key: CodeReviewSfxId) => void;
}) => {
  const { maxHp } = useAirJamSettings(codeReviewSettings);
  const sendSignal = useSendSignal();
  const hpSnapshotRef = useRef({ team1: maxHp, team2: maxHp });
  const [hpDisplay, setHpDisplay] = useState(() => ({
    team1: maxHp,
    team2: maxHp,
  }));

  useHostAgentCapture(() => captureAgentCanvas(getContext()?.canvas ?? null));

  useSimulationEvents<CodeReviewSimulationEvent>((event) => {
    if (event.type === "miss") playSfxFromRef("missed");
    else if (event.type === "hit") playSfxFromRef(`hit${event.variant}`);
    else if (event.type === "bell") playSfxFromRef("bell");
    else sendSignal("HAPTIC", { pattern: "heavy" }, event.controllerId);
  });

  useSimulationFrame<CodeReviewSimulationState>(({ sim }) => {
    const context = getContext();
    const arenaColors = getArenaColors();
    if (!context || !arenaColors) return;
    if (
      hpSnapshotRef.current.team1 !== sim.hp.team1 ||
      hpSnapshotRef.current.team2 !== sim.hp.team2
    ) {
      hpSnapshotRef.current = { ...sim.hp };
      setHpDisplay({ ...sim.hp });
    }
    drawFrame({
      context,
      now: performance.now(),
      timestamp: sim.clockMs,
      state: sim.fighters,
      participantBySlot,
      sprites: spritesRef.current,
      getTintedOverlaySprite,
      arenaColors,
      koState: sim.ko,
    });
  });

  return { hpDisplay };
};
