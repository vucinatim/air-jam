import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  circlesOverlap,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  isNearLocation,
  isValidPosition,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPAWN_POSITIONS,
} from "../game-constants";
import type { GameInput } from "../game/input";
import {
  useOfficeGameDurationMs,
  useOfficeGameOver,
  useOfficeGameStartTime,
  useOfficeLifecycleVersion,
  useOfficeMatchPhase,
  useSpaceStore,
  type PlayerStats,
} from "../game/stores";
import { mergePlayerStatUpdates } from "../game/stores/space-store-helpers";
import { getPlayerById, getTaskDurationMs, PLAYERS } from "../players";
import {
  BREAKROOM_LOCATIONS,
  LOCATIONS,
  STAT_CONSTANTS,
  TaskManager,
  type ActiveTask,
  type Location,
} from "../task-manager";
import { useSounds } from "./use-sounds";

interface BreakroomActivity {
  locationId: string;
  startTime: number;
}

interface GameState {
  positions: Record<string, { x: number; y: number }>;
  lastAction: Record<string, boolean>;
  playerAssignments: Record<string, string>;
  playerStats: Record<string, PlayerStats>;
  lastTaskCompleteTime: Record<string, number>;
  usedSpawnIndices: Set<number>;
}

interface UseOfficeGameRuntimeReturn {
  gameStateRef: React.MutableRefObject<GameState>;
  taskManagerRef: React.MutableRefObject<TaskManager>;
  pendingTasksRef: React.MutableRefObject<ActiveTask[]>;
  breakroomActivitiesRef: React.MutableRefObject<
    Record<string, BreakroomActivity | null>
  >;
  playerImagesRef: React.MutableRefObject<Record<string, HTMLImageElement>>;
  locationImagesRef: React.MutableRefObject<Record<string, HTMLImageElement>>;
  initializePlayers: (playerIds: string[]) => void;
  loadPlayerImages: () => Promise<void>;
  loadLocationImages: () => Promise<void>;
  updateGame: (
    currentTime: number,
    players: { id: string }[],
    getInput: (playerId: string) => GameInput | null,
    gameStatePlaying: boolean,
  ) => void;
}

interface UseOfficeGameRuntimeOptions {
  muted?: boolean;
  connectedPlayerIds?: string[];
}

export function useOfficeGameRuntime({
  muted = false,
  connectedPlayerIds = [],
}: UseOfficeGameRuntimeOptions = {}): UseOfficeGameRuntimeReturn {
  const playerAssignments = useSpaceStore((state) => state.playerAssignments);
  const playerStats = useSpaceStore((state) => state.playerStats);
  const gameOver = useOfficeGameOver();
  const gameStartTime = useOfficeGameStartTime();
  const gameDurationMs = useOfficeGameDurationMs();
  const matchPhase = useOfficeMatchPhase();
  const lifecycleVersion = useOfficeLifecycleVersion();
  const actions = useSpaceStore.useActions();

  const {
    playTaskStart,
    playTaskComplete,
    playNewOrder,
    playGameOver,
    playOrderTimeout,
  } = useSounds(muted);

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const gameState = useRef<GameState>({
    positions: {},
    lastAction: {},
    playerAssignments: {},
    playerStats: {},
    lastTaskCompleteTime: {},
    usedSpawnIndices: new Set<number>(),
  });

  const taskManagerRef = useRef(new TaskManager());
  const pendingTasksRef = useRef<ActiveTask[]>([]);
  const lastTaskUpdateRef = useRef(0);
  const lastStatUpdateRef = useRef(0);
  const lastTaskCountRef = useRef(0);
  const lastGameOverRef = useRef(false);
  const playerBoredomDecayTimers = useRef<Record<string, number>>({});
  const breakroomActivitiesRef = useRef<
    Record<string, BreakroomActivity | null>
  >({});
  const playerImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const locationImagesRef = useRef<Record<string, HTMLImageElement>>({});

  const playerAssignmentsRef = useRef(playerAssignments);
  useEffect(() => {
    playerAssignmentsRef.current = playerAssignments;
    gameState.current.playerAssignments = playerAssignments;
  }, [playerAssignments]);

  const playerStatsRef = useRef(playerStats);
  useEffect(() => {
    playerStatsRef.current = playerStats;
    gameState.current.playerStats = playerStats;
  }, [playerStats]);

  const gameOverRef = useRef(gameOver);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    if (gameOver && !lastGameOverRef.current) {
      playGameOver();
      lastGameOverRef.current = true;
      return;
    }

    if (!gameOver) {
      lastGameOverRef.current = false;
    }
  }, [gameOver, playGameOver]);

  const gameStartTimeRef = useRef(gameStartTime);
  useEffect(() => {
    gameStartTimeRef.current = gameStartTime;
  }, [gameStartTime]);

  const gameDurationMsRef = useRef(gameDurationMs);
  useEffect(() => {
    gameDurationMsRef.current = gameDurationMs;
  }, [gameDurationMs]);

  const initializePlayers = useCallback((playerIds: string[]) => {
    actionsRef.current.syncConnectedPlayers({ connectedPlayerIds: playerIds });

    const connectedSet = new Set(playerIds);

    Object.keys(gameState.current.positions).forEach((playerId) => {
      if (!connectedSet.has(playerId)) {
        delete gameState.current.positions[playerId];
      }
    });

    Object.keys(gameState.current.lastAction).forEach((playerId) => {
      if (!connectedSet.has(playerId)) {
        delete gameState.current.lastAction[playerId];
      }
    });

    Object.keys(gameState.current.lastTaskCompleteTime).forEach((playerId) => {
      if (!connectedSet.has(playerId)) {
        delete gameState.current.lastTaskCompleteTime[playerId];
      }
    });

    Object.keys(breakroomActivitiesRef.current).forEach((playerId) => {
      if (!connectedSet.has(playerId)) {
        delete breakroomActivitiesRef.current[playerId];
      }
    });

    Object.keys(playerBoredomDecayTimers.current).forEach((playerId) => {
      if (!connectedSet.has(playerId)) {
        delete playerBoredomDecayTimers.current[playerId];
      }
    });

    playerIds.forEach((playerId) => {
      if (gameState.current.positions[playerId]) {
        return;
      }

      let assignedPosition: { x: number; y: number } | null = null;
      for (let index = 0; index < SPAWN_POSITIONS.length; index += 1) {
        if (!gameState.current.usedSpawnIndices.has(index)) {
          assignedPosition = SPAWN_POSITIONS[index];
          gameState.current.usedSpawnIndices.add(index);
          break;
        }
      }

      if (assignedPosition) {
        gameState.current.positions[playerId] = {
          x: assignedPosition.x,
          y: assignedPosition.y,
        };
        return;
      }

      let x: number;
      let y: number;
      let attempts = 0;
      do {
        x = PLAYER_RADIUS + Math.random() * (FIELD_WIDTH - PLAYER_RADIUS * 2);
        y = PLAYER_RADIUS + Math.random() * (FIELD_HEIGHT - PLAYER_RADIUS * 2);
        attempts += 1;
      } while (!isValidPosition(x, y, PLAYER_RADIUS) && attempts < 50);

      gameState.current.positions[playerId] = { x, y };
    });
  }, []);

  const resetRuntimeState = useCallback(
    (
      playerIds: string[],
      nextAssignments: GameState["playerAssignments"],
      nextPlayerStats: GameState["playerStats"],
    ) => {
      const now = performance.now();

      gameState.current.positions = {};
      gameState.current.lastAction = {};
      gameState.current.playerAssignments = nextAssignments;
      gameState.current.playerStats = nextPlayerStats;
      gameState.current.lastTaskCompleteTime = {};
      gameState.current.usedSpawnIndices.clear();

      taskManagerRef.current.reset();
      pendingTasksRef.current = [];
      lastTaskUpdateRef.current = now;
      lastStatUpdateRef.current = now;
      lastTaskCountRef.current = 0;
      breakroomActivitiesRef.current = {};
      playerBoredomDecayTimers.current = {};

      playerIds.forEach((playerId) => {
        breakroomActivitiesRef.current[playerId] = null;
        playerBoredomDecayTimers.current[playerId] = 0;
      });
    },
    [],
  );

  const connectedPlayerIdsRef = useRef(connectedPlayerIds);
  useEffect(() => {
    connectedPlayerIdsRef.current = connectedPlayerIds;
  }, [connectedPlayerIds]);

  useEffect(() => {
    const playerIds = connectedPlayerIdsRef.current;
    resetRuntimeState(
      playerIds,
      playerAssignmentsRef.current,
      playerStatsRef.current,
    );
    if (matchPhase !== "ended") {
      initializePlayers(playerIds);
    }
  }, [initializePlayers, lifecycleVersion, matchPhase, resetRuntimeState]);

  const loadPlayerImages = useCallback(async () => {
    for (const player of PLAYERS) {
      if (player.image && !playerImagesRef.current[player.id]) {
        const img = new Image();
        img.src = player.image;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        playerImagesRef.current[player.id] = img;
      }
    }
  }, []);

  const loadLocationImages = useCallback(async () => {
    const allLocations = [...LOCATIONS, ...BREAKROOM_LOCATIONS];
    for (const location of allLocations) {
      if (location.image && !locationImagesRef.current[location.id]) {
        const img = new Image();
        img.src = location.image;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        locationImagesRef.current[location.id] = img;
      }
    }
  }, []);

  const handlePlayerMovement = (
    playerId: string,
    input: GameInput,
    allPlayerIds: string[],
  ): boolean => {
    const position = gameState.current.positions[playerId];
    if (!position) {
      return false;
    }

    const newX = position.x + input.movementX * PLAYER_SPEED;
    const newY = position.y + input.movementY * PLAYER_SPEED;

    const collidesWithPlayer = (x: number, y: number) =>
      allPlayerIds.some((otherId) => {
        if (otherId === playerId) {
          return false;
        }

        const otherPosition = gameState.current.positions[otherId];
        if (!otherPosition) {
          return false;
        }

        return circlesOverlap(
          x,
          y,
          PLAYER_RADIUS,
          otherPosition.x,
          otherPosition.y,
          PLAYER_RADIUS,
        );
      });

    if (
      isValidPosition(newX, newY, PLAYER_RADIUS) &&
      !collidesWithPlayer(newX, newY)
    ) {
      position.x = newX;
      position.y = newY;
      return true;
    }

    if (
      isValidPosition(newX, position.y, PLAYER_RADIUS) &&
      !collidesWithPlayer(newX, position.y)
    ) {
      position.x = newX;
      return true;
    }

    if (
      isValidPosition(position.x, newY, PLAYER_RADIUS) &&
      !collidesWithPlayer(position.x, newY)
    ) {
      position.y = newY;
      return true;
    }

    return false;
  };

  const handleTaskStart = (
    playerId: string,
    position: { x: number; y: number },
    locations: Location[],
  ): boolean => {
    for (const location of locations) {
      if (!isNearLocation(position.x, position.y, location.id, locations)) {
        continue;
      }

      const player = getPlayerById(gameState.current.playerAssignments[playerId]);
      if (!player) {
        break;
      }

      if (taskManagerRef.current.isDoingTask(playerId)) {
        break;
      }

      const lastCompletedAt = gameState.current.lastTaskCompleteTime[playerId] || 0;
      if (Date.now() - lastCompletedAt < 1000) {
        break;
      }

      const task = taskManagerRef.current.getTaskAt(location.id);
      if (!task) {
        break;
      }

      const durationMs = getTaskDurationMs(task.taskDefId, player.id);
      const started = taskManagerRef.current.startTask(
        playerId,
        location.id,
        durationMs,
      );

      if (!started) {
        break;
      }

      actionsRef.current.setBusy({ playerId, taskName: task.name });
      toast(`${player.name} je prevzel nalogo "${task.name}"`, {
        duration: 1500,
      });
      playTaskStart();
      return true;
    }

    return false;
  };

  const handleTaskComplete = (playerId: string): boolean => {
    const completed = taskManagerRef.current.completeTask(playerId);
    if (!completed) {
      return false;
    }

    actionsRef.current.completeTask({
      playerId,
      reward: completed.reward,
    });
    actionsRef.current.setBusy({ playerId, taskName: null });
    gameState.current.lastTaskCompleteTime[playerId] = Date.now();

    const completedPlayer = getPlayerById(gameState.current.playerAssignments[playerId]);
    toast.success(
      `${completedPlayer?.name ?? "Igralec"} je končal ${completed.name}!`,
      {
        duration: 2000,
      },
    );
    playTaskComplete();
    return true;
  };

  const handleBreakroomActivityComplete = (
    playerId: string,
    currentTime: number,
  ): void => {
    const currentActivity = breakroomActivitiesRef.current[playerId];
    if (!currentActivity) {
      return;
    }

    const elapsed = currentTime - currentActivity.startTime;
    if (elapsed < STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS) {
      return;
    }

    const locationId = currentActivity.locationId;
    const playerName =
      getPlayerById(gameState.current.playerAssignments[playerId])?.name ||
      "Player";

    if (locationId === "coffee-machine") {
      actionsRef.current.restoreEnergy({
        playerId,
        amount: STAT_CONSTANTS.COFFEE_ENERGY_RESTORE,
      });
      toast(`${playerName} je spil kavo!`, {
        description: `+${STAT_CONSTANTS.COFFEE_ENERGY_RESTORE} energije`,
        duration: 2000,
      });
    } else if (locationId === "lunch-spot") {
      actionsRef.current.restoreEnergy({
        playerId,
        amount: STAT_CONSTANTS.LUNCH_ENERGY_RESTORE,
      });
      toast(`${playerName} je pojedel malico!`, {
        description: `+${STAT_CONSTANTS.LUNCH_ENERGY_RESTORE} energije`,
        duration: 2000,
      });
    } else if (locationId === "fifa-table") {
      actionsRef.current.restoreBoredom({
        playerId,
        amount: STAT_CONSTANTS.FIFA_BOREDOM_RESTORE,
      });
      toast(`${playerName} je igral FIFO!`, {
        description: `+${STAT_CONSTANTS.FIFA_BOREDOM_RESTORE} sreče`,
        duration: 2000,
      });
    } else if (
      locationId === "rest-sramote" ||
      locationId === "couch-jok" ||
      locationId === "couch-kuhinja"
    ) {
      actionsRef.current.restoreEnergy({
        playerId,
        amount: STAT_CONSTANTS.LUNCH_ENERGY_RESTORE,
      });
      toast(`${playerName} je počival!`, {
        description: `+${STAT_CONSTANTS.LUNCH_ENERGY_RESTORE} energije`,
        duration: 2000,
      });
    }

    breakroomActivitiesRef.current[playerId] = null;
    actionsRef.current.setBusy({ playerId, taskName: null });
  };

  const handleBreakroomAction = (
    playerId: string,
    position: { x: number; y: number },
    currentTime: number,
  ): boolean => {
    if (breakroomActivitiesRef.current[playerId]) {
      return false;
    }

    for (const location of BREAKROOM_LOCATIONS) {
      if (
        !isNearLocation(
          position.x,
          position.y,
          location.id,
          BREAKROOM_LOCATIONS as Location[],
        )
      ) {
        continue;
      }

      const currentStats = gameState.current.playerStats[playerId];
      if (!currentStats?.alive) {
        break;
      }

      if (location.id === "coffee-machine") {
        const task = taskManagerRef.current.getTaskAt(location.id);
        if (task) {
          const player = getPlayerById(gameState.current.playerAssignments[playerId]);
          if (!player) {
            break;
          }

          const lastCompletedAt =
            gameState.current.lastTaskCompleteTime[playerId] || 0;
          if (Date.now() - lastCompletedAt < 1000) {
            break;
          }

          const durationMs = getTaskDurationMs(task.taskDefId, player.id);
          const started = taskManagerRef.current.startTask(
            playerId,
            location.id,
            durationMs,
          );
          if (started) {
            actionsRef.current.setBusy({ playerId, taskName: task.name });
            toast(`${player.name} je začel nalogo "${task.name}"`, {
              duration: 1500,
            });
          }
          return true;
        }
      }

      breakroomActivitiesRef.current[playerId] = {
        locationId: location.id,
        startTime: currentTime,
      };

      let activityName = "";
      if (location.id === "coffee-machine") {
        activityName = "Pijem kavo";
      } else if (location.id === "lunch-spot") {
        activityName = "Jem malico";
      } else if (location.id === "fifa-table") {
        activityName = "Igram FIFA";
      } else if (
        location.id === "rest-sramote" ||
        location.id === "couch-jok" ||
        location.id === "couch-kuhinja"
      ) {
        activityName = "Počivam";
      }

      actionsRef.current.setBusy({ playerId, taskName: activityName });
      return true;
    }

    return false;
  };

  const getNextPlayerStats = (
    playerId: string,
    currentTime: number,
  ): Partial<PlayerStats> | null => {
    const stats = gameState.current.playerStats[playerId];
    if (!stats?.alive) {
      return null;
    }

    if (breakroomActivitiesRef.current[playerId]) {
      return null;
    }

    const nextEnergy = Math.max(
      0,
      stats.energy - STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND,
    );

    let nextBoredom = stats.boredom;
    const boredomTimer = playerBoredomDecayTimers.current[playerId] || 0;
    if (currentTime > boredomTimer) {
      const decayAmount =
        STAT_CONSTANTS.BOREDOM_DECAY_MIN +
        Math.random() *
          (STAT_CONSTANTS.BOREDOM_DECAY_MAX - STAT_CONSTANTS.BOREDOM_DECAY_MIN);
      nextBoredom = Math.max(0, stats.boredom - decayAmount);

      const nextInterval =
        STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MIN_MS +
        Math.random() *
          (STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MAX_MS -
            STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MIN_MS);
      playerBoredomDecayTimers.current[playerId] = currentTime + nextInterval;
    }

    const nextStats: Partial<PlayerStats> = {
      energy: nextEnergy,
      boredom: nextBoredom,
    };

    if (nextEnergy <= 0 || nextBoredom <= 0) {
      nextStats.alive = false;
      nextStats.energy = 0;
      nextStats.boredom = 0;

      const playerName =
        getPlayerById(gameState.current.playerAssignments[playerId])?.name ||
        "Player";
      const deathReason = nextEnergy <= 0 ? "lakote" : "dolgčasa";
      toast.error(`${playerName} je umrl od ${deathReason}`, {
        duration: 3000,
      });
    }

    if (
      stats.energy === nextStats.energy &&
      stats.boredom === nextStats.boredom &&
      (nextStats.alive === undefined || stats.alive === nextStats.alive)
    ) {
      return null;
    }

    return nextStats;
  };

  const updateGame = useCallback(
    (
      currentTime: number,
      players: { id: string }[],
      getInput: (playerId: string) => GameInput | null,
      gameStatePlaying: boolean,
    ): void => {
      const finishMatch = () => {
        if (gameOverRef.current) {
          return;
        }

        gameOverRef.current = true;
        actionsRef.current.finishMatch();
      };

      if (!gameStatePlaying || gameOverRef.current) {
        return;
      }

      const elapsedTime = currentTime - gameStartTimeRef.current;
      if (elapsedTime >= gameDurationMsRef.current) {
        finishMatch();
        return;
      }

      const expiredTasks = taskManagerRef.current.update(currentTime);
      if (expiredTasks.length > 0) {
        const totalPenalty = expiredTasks.length * 100;
        actionsRef.current.applyPenalty({ amount: totalPenalty });
        playOrderTimeout();
      }

      if (currentTime - lastTaskUpdateRef.current > 500) {
        const currentTasks = taskManagerRef.current.getTasks();
        if (currentTasks.length > lastTaskCountRef.current) {
          playNewOrder();
        }
        lastTaskCountRef.current = currentTasks.length;
        pendingTasksRef.current = currentTasks;
        lastTaskUpdateRef.current = currentTime;
      }

      const playerIds = players.map((player) => player.id);
      const progressByPlayerId: Record<string, number> = {};
      const shouldUpdateStats = currentTime - lastStatUpdateRef.current > 1000;
      const playerStatsUpdates: Record<string, Partial<PlayerStats>> = {};

      players.forEach((player) => {
        const input = getInput(player.id);
        const position = gameState.current.positions[player.id];
        if (!input || !position) {
          return;
        }

        const isDoingTask = taskManagerRef.current.isDoingTask(player.id);
        const breakroomActivity = breakroomActivitiesRef.current[player.id];

        if (isDoingTask) {
          progressByPlayerId[player.id] =
            taskManagerRef.current.getTaskProgress(player.id);
        } else if (breakroomActivity) {
          const elapsed = currentTime - breakroomActivity.startTime;
          progressByPlayerId[player.id] = Math.min(
            elapsed / STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS,
            1,
          );
        }

        if (!isDoingTask) {
          handlePlayerMovement(player.id, input, playerIds);
        }

        if (input.action && !gameState.current.lastAction[player.id]) {
          const taskStarted = handleTaskStart(player.id, position, LOCATIONS);
          if (!taskStarted) {
            handleBreakroomAction(player.id, position, currentTime);
          }
        }

        handleTaskComplete(player.id);
        handleBreakroomActivityComplete(player.id, currentTime);

        if (shouldUpdateStats) {
          const nextStats = getNextPlayerStats(player.id, currentTime);
          if (nextStats) {
            playerStatsUpdates[player.id] = nextStats;
          }
        }

        gameState.current.lastAction[player.id] = input.action;
      });

      if (Object.keys(progressByPlayerId).length > 0) {
        actionsRef.current.setTaskProgressBatch({ progressByPlayerId });
      }

      if (Object.keys(playerStatsUpdates).length > 0) {
        gameState.current.playerStats = mergePlayerStatUpdates(
          gameState.current.playerStats,
          playerStatsUpdates,
        );
        actionsRef.current.updatePlayerStatsBatch({
          updatesByPlayerId: playerStatsUpdates,
        });
      }

      if (shouldUpdateStats) {
        lastStatUpdateRef.current = currentTime;
      }

      const allPlayersDead =
        players.length > 0 &&
        players.every((player) => {
          const stats = gameState.current.playerStats[player.id];
          return stats && !stats.alive;
        });

      if (allPlayersDead) {
        finishMatch();
      }
    },
    [playNewOrder, playOrderTimeout, playTaskComplete, playTaskStart],
  );

  return {
    gameStateRef: gameState,
    taskManagerRef,
    pendingTasksRef,
    breakroomActivitiesRef,
    playerImagesRef,
    locationImagesRef,
    initializePlayers,
    loadPlayerImages,
    loadLocationImages,
    updateGame,
  };
}

export function useOfficePendingTasks(
  pendingTasksRef: React.MutableRefObject<ActiveTask[]>,
): ActiveTask[] {
  const [pendingTasks, setPendingTasks] = useState(() => pendingTasksRef.current);

  useEffect(() => {
    setPendingTasks(pendingTasksRef.current);

    const interval = window.setInterval(() => {
      setPendingTasks((currentTasks) => {
        const nextTasks = pendingTasksRef.current;
        return currentTasks === nextTasks ? currentTasks : nextTasks;
      });
    }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, [pendingTasksRef]);

  return pendingTasks;
}

export function useOfficeMatchClock(isMatchPlaying: boolean): number {
  const gameStartTime = useOfficeGameStartTime();
  const gameDurationMs = useOfficeGameDurationMs();
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    setClockNow(Date.now());

    if (!isMatchPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [gameDurationMs, gameStartTime, isMatchPlaying]);

  return isMatchPlaying
    ? Math.max(0, gameDurationMs - (clockNow - gameStartTime))
    : gameDurationMs;
}
