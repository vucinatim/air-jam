import {
  useHostActionListener,
  useSimulationEvents,
  useSimulationFrame,
} from "@air-jam/sdk";
import { useState } from "react";
import { toast } from "sonner";
import { getPlayerById } from "../../game/content/players";
import type { ActiveTask } from "../../game/domain/task-manager";
import { STAT_CONSTANTS } from "../../game/domain/task-manager";
import type {
  OfficeSimulationEvent,
  OfficeSimulationState,
} from "../../game/engine/office-simulation";
import {
  spaceStore,
  useOfficeGameDurationMs,
  useOfficeMatchPhase,
} from "../../game/stores";
import { useOfficeSounds } from "./use-office-sounds";

const CLOCK_PUBLISH_MS = 250;

const playerName = (playerId: string) =>
  getPlayerById(spaceStore.getState().playerAssignments[playerId])?.name ??
  "Igralec";

const BREAK_TOASTS: Record<string, { message: string; description: string }> = {
  "coffee-machine": {
    message: "je spil kavo!",
    description: `+${STAT_CONSTANTS.COFFEE_ENERGY_RESTORE} energije`,
  },
  "lunch-spot": {
    message: "je pojedel malico!",
    description: `+${STAT_CONSTANTS.LUNCH_ENERGY_RESTORE} energije`,
  },
  "fifa-table": {
    message: "je igral FIFO!",
    description: `+${STAT_CONSTANTS.FIFA_BOREDOM_RESTORE} sreče`,
  },
};

/** Turns what happened in the match into toasts and sounds. */
export function useOfficeFeedback(muted: boolean): void {
  const sounds = useOfficeSounds(muted);

  useSimulationEvents<OfficeSimulationEvent>((event) => {
    if (event.type === "task-started") {
      toast(
        `${playerName(event.playerId)} je prevzel nalogo "${event.taskName}"`,
        {
          duration: 1500,
        },
      );
      sounds.playTaskStart();
    } else if (event.type === "task-completed") {
      toast.success(
        `${playerName(event.playerId)} je končal ${event.taskName}!`,
        {
          duration: 2000,
        },
      );
      sounds.playTaskComplete();
    } else if (event.type === "break-finished") {
      const rest = BREAK_TOASTS[event.locationId] ?? {
        message: "je počival!",
        description: `+${STAT_CONSTANTS.LUNCH_ENERGY_RESTORE} energije`,
      };
      toast(`${playerName(event.playerId)} ${rest.message}`, {
        description: rest.description,
        duration: 2000,
      });
    } else if (event.type === "player-died") {
      toast.error(
        `${playerName(event.playerId)} je umrl od ${event.cause === "energy" ? "lakote" : "dolgčasa"}`,
        { duration: 3000 },
      );
    } else if (event.type === "orders-expired") sounds.playOrderTimeout();
    else sounds.playNewOrder();
  });

  useHostActionListener(spaceStore, () => sounds.playGameOver(), {
    actionNames: ["finishMatch"],
  });
}

/** The open orders, refreshed as the simulation refreshes them. */
export function useOfficePendingTasks(): ActiveTask[] {
  const [pendingTasks, setPendingTasks] = useState<ActiveTask[]>([]);
  useSimulationFrame<OfficeSimulationState>(({ sim }) => {
    setPendingTasks((current) =>
      current === sim.pendingTasks ? current : sim.pendingTasks,
    );
  });
  return pendingTasks;
}

/** Match time left, published a few times a second for the clock display. */
export function useOfficeTimeRemainingMs(): number {
  const gameDurationMs = useOfficeGameDurationMs();
  const matchPhase = useOfficeMatchPhase();
  const [elapsedMs, setElapsedMs] = useState(0);
  useSimulationFrame<OfficeSimulationState>(({ sim }) => {
    const published =
      sim.elapsedMs >= gameDurationMs
        ? gameDurationMs
        : Math.floor(sim.elapsedMs / CLOCK_PUBLISH_MS) * CLOCK_PUBLISH_MS;
    setElapsedMs((current) => (current === published ? current : published));
  });
  return matchPhase === "lobby"
    ? gameDurationMs
    : Math.max(0, gameDurationMs - elapsedMs);
}
