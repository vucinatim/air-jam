import {
  useAirJamHost,
  useGetInput,
  useHostTick,
  useSendSignal,
} from "@air-jam/sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { gameInputSchema } from "../../game/contracts/input";
import type { CodeReviewSfxId } from "../../game/contracts/sounds";
import { MATCH_POINTS_TO_WIN } from "../../game/domain/match-rules";
import { MAX_HP } from "../../game/engine/constants";
import { drawFrame } from "../../game/engine/render";
import {
  createHpState,
  createKoState,
  createRuntimePlayerState,
} from "../../game/engine/runtime-state";
import { stepMatchFrame } from "../../game/engine/simulation";
import type {
  ArenaColors,
  HpState,
  PlayerKey,
  SlotParticipant,
  SpriteKey,
} from "../../game/engine/types";
import { useGameStore } from "../../game/stores";
import type { CodeReviewMatchPhase } from "../../game/stores/code-review-store-types";

const CODE_REVIEW_SIMULATION_STEP_MS = 1000 / 60;

interface UseCodeReviewHostRuntimeOptions {
  matchPhase: CodeReviewMatchPhase;
  participantBySlot: Partial<Record<PlayerKey, SlotParticipant>>;
  slotParticipants: SlotParticipant[];
  spritesRef: MutableRefObject<Record<SpriteKey, HTMLCanvasElement | null>>;
  getContext: () => CanvasRenderingContext2D | null;
  getArenaColors: () => ArenaColors | null;
  getTintedOverlaySprite: (
    spriteKey: SpriteKey,
    sprite: HTMLCanvasElement,
    color: string,
  ) => HTMLCanvasElement;
  playSfxFromRef: (key: CodeReviewSfxId) => void;
}

export const useCodeReviewHostRuntime = ({
  matchPhase,
  participantBySlot,
  slotParticipants,
  spritesRef,
  getContext,
  getArenaColors,
  getTintedOverlaySprite,
  playSfxFromRef,
}: UseCodeReviewHostRuntimeOptions) => {
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const getInput = useGetInput<typeof gameInputSchema>();
  const sendSignal = useSendSignal();
  const actions = useGameStore.useActions();
  const scores = useGameStore((state) => state.scores);
  const gameStateRef = useRef(createRuntimePlayerState());
  const hpRef = useRef<HpState>(createHpState());
  const koRef = useRef(createKoState());
  const hpSnapshotRef = useRef({ team1: MAX_HP, team2: MAX_HP });
  const [hpDisplay, setHpDisplay] = useState(() => ({
    team1: MAX_HP,
    team2: MAX_HP,
  }));

  const syncHpDisplay = useCallback(() => {
    const nextHp = hpRef.current;
    if (
      hpSnapshotRef.current.team1 === nextHp.team1 &&
      hpSnapshotRef.current.team2 === nextHp.team2
    ) {
      return;
    }

    hpSnapshotRef.current = { ...nextHp };
    setHpDisplay({ ...nextHp });
  }, []);

  useHostTick({
    enabled: true,
    mode: "fixed",
    intervalMs: CODE_REVIEW_SIMULATION_STEP_MS,
    onTick: ({ deltaMs }) => {
      if (matchPhase !== "playing" || runtimeState !== "playing") {
        return;
      }

      stepMatchFrame({
        state: gameStateRef.current,
        participants: slotParticipants,
        participantBySlot,
        hpState: hpRef.current,
        koState: koRef.current,
        dt: deltaMs,
        timestamp: Date.now(),
        getInput,
        onMiss: () => playSfxFromRef("missed"),
        onHit: () => playSfxFromRef(Math.random() > 0.5 ? "hit1" : "hit2"),
        onBell: () => playSfxFromRef("bell"),
        onScore: (team) => actions.scorePoint({ team }),
        onHeavyHit: (controllerId) => {
          sendSignal("HAPTIC", { pattern: "heavy" }, controllerId);
        },
      });
    },
    onFrame: ({ now }) => {
      const context = getContext();
      const arenaColors = getArenaColors();
      if (!context || !arenaColors) {
        return;
      }

      syncHpDisplay();
      drawFrame({
        context,
        now,
        timestamp: Date.now(),
        state: gameStateRef.current,
        participantBySlot,
        sprites: spritesRef.current,
        getTintedOverlaySprite,
        arenaColors,
        koState: koRef.current,
      });
    },
  });

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

  return {
    hpDisplay,
  };
};
