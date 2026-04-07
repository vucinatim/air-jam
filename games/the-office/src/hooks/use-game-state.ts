/**
 * Custom hook for managing game state and logic.
 * Handles player movement, tasks, breakroom activities, stats, and game loop state.
 */

import { useEffect, useRef } from "react";
import { useSounds } from "./use-sounds";
import { toast } from "sonner";
import {
  TaskManager,
  LOCATIONS,
  BREAKROOM_LOCATIONS,
  STAT_CONSTANTS,
  type ActiveTask,
  type Location,
} from "../task-manager";
import {
  getPlayerById,
  PLAYERS,
  getTaskDurationMs,
} from "../players";
import {
  useSpaceStore,
  type SpaceGameState,
  type PlayerStats,
} from "../game/stores";
import type { GameInput } from "../game/input";
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPAWN_POSITIONS,
  isValidPosition,
  isNearLocation,
  circlesOverlap,
} from "../game-constants";

// Type for breakroom activity state
interface BreakroomActivity {
  locationId: string;
  startTime: number;
}

// Game state interface (using refs to avoid re-renders during game loop)
interface GameState {
  positions: Record<string, { x: number; y: number }>;
  lastAction: Record<string, boolean>;
  playerAssignments: Record<string, string>;
  playerStats: Record<string, PlayerStats>;
  lastTaskCompleteTime: Record<string, number>;
  usedSpawnIndices: Set<number>;
}

// Return type for the hook
interface UseGameStateReturn {
  gameStateRef: React.MutableRefObject<GameState>;
  taskManagerRef: React.MutableRefObject<TaskManager>;
  pendingTasksRef: React.MutableRefObject<ActiveTask[]>;
  lastTaskUpdateRef: React.MutableRefObject<number>;
  lastStatUpdateRef: React.MutableRefObject<number>;
  playerBoredomDecayTimers: React.MutableRefObject<Record<string, number>>;
  breakroomActivitiesRef: React.MutableRefObject<
    Record<string, BreakroomActivity | null>
  >;
  playerImagesRef: React.MutableRefObject<Record<string, HTMLImageElement>>;
  locationImagesRef: React.MutableRefObject<Record<string, HTMLImageElement>>;
  money: Record<string, number>;
  gameOver: boolean;
  totalMoney: number;
  finalTotalMoney: number;
  timeRemaining: number;
  initializePlayers: (playerIds: string[]) => void;
  loadPlayerImages: () => Promise<void>;
  loadLocationImages: () => Promise<void>;
  updateGame: (
    currentTime: number,
    players: { id: string }[],
    getInput: (playerId: string) => GameInput | null,
    gameStatePlaying: boolean,
  ) => void;
  startMatch: () => void;
  resetGame: (playerIds: string[]) => void;
}

interface UseGameStateOptions {
  muted?: boolean;
}

/**
 * Hook to manage all game state and logic.
 */
export function useGameState({
  muted = false,
}: UseGameStateOptions = {}): UseGameStateReturn {
  // Zustand store selectors with atomic selectors
  const money = useSpaceStore((state: SpaceGameState) => state.money);
  const playerAssignments = useSpaceStore(
    (state: SpaceGameState) => state.playerAssignments,
  );
  const playerStats = useSpaceStore(
    (state: SpaceGameState) => state.playerStats,
  );
  const gameOver = useSpaceStore((state: SpaceGameState) => state.gameOver);
  const gameStartTime = useSpaceStore((state: SpaceGameState) => state.gameStartTime);
  const gameDurationMs = useSpaceStore((state: SpaceGameState) => state.gameDurationMs);
  const totalMoneyPenalty = useSpaceStore((state: SpaceGameState) => state.totalMoneyPenalty);
  const actions = useSpaceStore.useActions();

  // Sound effects hook
  const {
    playTaskStart,
    playTaskComplete,
    playNewOrder,
    playGameOver,
    playOrderTimeout,
  } = useSounds(muted);

  // Keep actions in ref to avoid closure staleness in game loop
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  // Core game state refs (mutable to avoid re-renders during game loop)
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

  // Sync gameState refs with store values
  useEffect(() => {
    gameState.current.playerAssignments = playerAssignments;
  }, [playerAssignments]);

  useEffect(() => {
    gameState.current.playerStats = playerStats;
  }, [playerStats]);

  // Calculate total money and final money after penalties
  const totalMoney = Object.values(money).reduce((sum, m) => sum + m, 0);
  const finalTotalMoney = totalMoney - totalMoneyPenalty;
  
  // Calculate time remaining
  const timeRemaining = Math.max(0, gameDurationMs - (Date.now() - gameStartTime));

  /**
   * Initialize player positions and assignments for new players.
   * Players spawn at unique predefined positions (max 9 players).
   * Positions are assigned sequentially (Player 1 -> Position 1, Player 2 -> Position 2, etc.)
   */
  const initializePlayers = (playerIds: string[]) => {
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
      if (!gameState.current.positions[playerId]) {
        // Find the first available predefined position
        let assignedPosition: { x: number; y: number } | null = null;
        
        for (let i = 0; i < SPAWN_POSITIONS.length; i++) {
          if (!gameState.current.usedSpawnIndices.has(i)) {
            assignedPosition = SPAWN_POSITIONS[i];
            gameState.current.usedSpawnIndices.add(i);
            break;
          }
        }

        if (assignedPosition) {
          // Assign predefined position
          gameState.current.positions[playerId] = { x: assignedPosition.x, y: assignedPosition.y };
        } else {
          // Fallback to random position if all predefined positions are used
          let x: number, y: number;
          let attempts = 0;
          do {
            x = PLAYER_RADIUS + Math.random() * (FIELD_WIDTH - PLAYER_RADIUS * 2);
            y = PLAYER_RADIUS + Math.random() * (FIELD_HEIGHT - PLAYER_RADIUS * 2);
            attempts++;
          } while (!isValidPosition(x, y, PLAYER_RADIUS) && attempts < 50);
          gameState.current.positions[playerId] = { x, y };
        }
      }
    });
  };

  /**
   * Load player images for all players.
   */
  const loadPlayerImages = async () => {
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
  };

  /**
   * Load location images for all locations.
   */
  const loadLocationImages = async () => {
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
  };

  /**
   * Handle player movement with collision detection.
   */
  const handlePlayerMovement = (
    playerId: string,
    input: GameInput,
    allPlayerIds: string[],
  ): boolean => {
    const pos = gameState.current.positions[playerId];
    if (!pos) return false;

    const newX = pos.x + input.movementX * PLAYER_SPEED;
    const newY = pos.y + input.movementY * PLAYER_SPEED;

    const collidesWithPlayer = (x: number, y: number) => {
      return allPlayerIds.some((otherId) => {
        if (otherId === playerId) return false;
        const otherPos = gameState.current.positions[otherId];
        if (!otherPos) return false;
        return circlesOverlap(
          x,
          y,
          PLAYER_RADIUS,
          otherPos.x,
          otherPos.y,
          PLAYER_RADIUS,
        );
      });
    };

    // Try to move in both directions
    if (
      isValidPosition(newX, newY, PLAYER_RADIUS) &&
      !collidesWithPlayer(newX, newY)
    ) {
      pos.x = newX;
      pos.y = newY;
      return true;
    } else if (
      isValidPosition(newX, pos.y, PLAYER_RADIUS) &&
      !collidesWithPlayer(newX, pos.y)
    ) {
      pos.x = newX;
      return true;
    } else if (
      isValidPosition(pos.x, newY, PLAYER_RADIUS) &&
      !collidesWithPlayer(pos.x, newY)
    ) {
      pos.y = newY;
      return true;
    }
    return false;
  };

  /**
   * Handle starting a task at a location.
   */
  const handleTaskStart = (
    playerId: string,
    pos: { x: number; y: number },
    locations: Location[],
  ): boolean => {
    for (const location of locations) {
      if (isNearLocation(pos.x, pos.y, location.id, locations)) {
        const player = getPlayerById(
          gameState.current.playerAssignments[playerId],
        );
        if (!player) break;

        if (taskManagerRef.current.isDoingTask(playerId)) break;

        // Cooldown check - don't allow starting new task within 1 second of completing
        const lastComplete =
          gameState.current.lastTaskCompleteTime[playerId] || 0;
        if (Date.now() - lastComplete < 1000) break;

        const task = taskManagerRef.current.getTaskAt(location.id);
        if (!task) break;

        // Calculate duration based on player's capability
        const durationMs = getTaskDurationMs(task.taskDefId, player.id);

        const started = taskManagerRef.current.startTask(
          playerId,
          location.id,
          durationMs,
        );
        if (started) {
          actionsRef.current.setBusy({ playerId, taskName: task.name });
              toast(`${player.name} je prevzel nalogo "${task.name}"`, {
            duration: 1500,
          });
          playTaskStart();
        }
        return true;
      }
    }
    return false;
  };

  /**
   * Handle completing a task.
   */
  const handleTaskComplete = (playerId: string): boolean => {
    const completed = taskManagerRef.current.completeTask(playerId);
    if (completed) {
      actionsRef.current.completeTask({
        playerId,
        reward: completed.reward,
      });
      actionsRef.current.setBusy({ playerId, taskName: null });
      gameState.current.lastTaskCompleteTime[playerId] = Date.now();
      const completedPlayer = getPlayerById(
        gameState.current.playerAssignments[playerId],
      );
      toast.success(
        `${completedPlayer?.name ?? "Igralec"} je končal ${completed.name}!`,
        {
          duration: 2000,
        },
      );
      playTaskComplete();
      return true;
    }
    return false;
  };

  /**
   * Handle breakroom activity completion.
   */
  const handleBreakroomActivityComplete = (
    playerId: string,
    currentTime: number,
  ): void => {
    const currentActivity = breakroomActivitiesRef.current[playerId];
    if (!currentActivity) return;

    const elapsed = currentTime - currentActivity.startTime;
    if (elapsed >= STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS) {
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
    }
  };

  /**
   * Handle breakroom action button press.
   */
  const handleBreakroomAction = (
    playerId: string,
    pos: { x: number; y: number },
    currentTime: number,
  ): boolean => {
    const currentActivity = breakroomActivitiesRef.current[playerId];
    if (currentActivity) return false;

    for (const location of BREAKROOM_LOCATIONS) {
      if (
        isNearLocation(
          pos.x,
          pos.y,
          location.id,
          BREAKROOM_LOCATIONS as Location[],
        )
      ) {
        const playerStats = gameState.current.playerStats[playerId];
        if (!playerStats?.alive) break;

        // Dual-purpose coffee machine: if task spawned, do task instead
        if (location.id === "coffee-machine") {
          const task = taskManagerRef.current.getTaskAt(location.id);
          if (task) {
            const player = getPlayerById(
              gameState.current.playerAssignments[playerId],
            );
            if (!player) break;

            const lastComplete =
              gameState.current.lastTaskCompleteTime[playerId] || 0;
            if (Date.now() - lastComplete < 1000) break;

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

        // Start breakroom activity
        breakroomActivitiesRef.current[playerId] = {
          locationId: location.id,
          startTime: currentTime,
        };

        let activityName = "";
        if (location.id === "coffee-machine") activityName = "Pijem kavo";
        else if (location.id === "lunch-spot") activityName = "Jem malico";
        else if (location.id === "fifa-table") activityName = "Igram FIFA";
        else if (
          location.id === "rest-sramote" ||
          location.id === "couch-jok" ||
          location.id === "couch-kuhinja"
        )
          activityName = "Počivam";

        actionsRef.current.setBusy({ playerId, taskName: activityName });
        return true;
      }
    }
    return false;
  };

  /**
   * Update player stats (energy and boredom decay).
   */
  const updatePlayerStats = (playerId: string, currentTime: number): void => {
    const stats = gameState.current.playerStats[playerId];
    if (!stats?.alive) return;

    const currentActivity = breakroomActivitiesRef.current[playerId];
    if (currentActivity) return; // Don't decay stats during breakroom activities

    // Decay energy constantly
    const newEnergy = Math.max(
      0,
      stats.energy - STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND,
    );

    // Random boredom decay
    let newBoredom = stats.boredom;
    const boredomTimer = playerBoredomDecayTimers.current[playerId] || 0;
    if (currentTime > boredomTimer) {
      const decayAmount =
        STAT_CONSTANTS.BOREDOM_DECAY_MIN +
        Math.random() *
          (STAT_CONSTANTS.BOREDOM_DECAY_MAX - STAT_CONSTANTS.BOREDOM_DECAY_MIN);
      newBoredom = Math.max(0, stats.boredom - decayAmount);
      // Set next boredom decay timer
      const nextInterval =
        STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MIN_MS +
        Math.random() *
          (STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MAX_MS -
            STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MIN_MS);
      playerBoredomDecayTimers.current[playerId] = currentTime + nextInterval;
    }

    actionsRef.current.updatePlayerStats({
      playerId,
      updates: {
        energy: newEnergy,
        boredom: newBoredom,
      },
    });

    // Check for death
    if (newEnergy <= 0 || newBoredom <= 0) {
      const playerName =
        getPlayerById(gameState.current.playerAssignments[playerId])?.name ||
        "Player";
      actionsRef.current.killPlayer({ playerId });
      const deathReason = newEnergy <= 0 ? "lakote" : "dolgčasa";
      toast.error(`${playerName} je umrl od ${deathReason}`, {
        duration: 3000,
      });
    }
  };

  /**
   * Main game update function called every frame.
   */
  const updateGame = (
    currentTime: number,
    players: { id: string }[],
    getInput: (playerId: string) => GameInput | null,
    gameStatePlaying: boolean,
  ): void => {
    if (!gameStatePlaying || gameOver) return;

    // Check if game timer has expired
    const elapsedTime = currentTime - gameStartTime;
    if (elapsedTime >= gameDurationMs) {
      actionsRef.current.setGameOver({ gameOver: true });
      return;
    }

    // Update task manager and get expired tasks
    const expiredTasks = taskManagerRef.current.update(currentTime);
    
    // Apply penalty for each expired task (€100 per task)
    if (expiredTasks.length > 0) {
      const penaltyPerTask = 100;
      const totalPenalty = expiredTasks.length * penaltyPerTask;
      actionsRef.current.applyPenalty({ amount: totalPenalty });
      playOrderTimeout();
    }

    // Sync pending tasks to state every 500ms
    if (currentTime - lastTaskUpdateRef.current > 500) {
      const currentTasks = taskManagerRef.current.getTasks();
      // Play sound if new tasks were spawned
      if (currentTasks.length > lastTaskCountRef.current) {
        playNewOrder();
      }
      lastTaskCountRef.current = currentTasks.length;
      pendingTasksRef.current = currentTasks;
      lastTaskUpdateRef.current = currentTime;
    }

    // Play game over sound when game ends
    if (gameOver && !lastGameOverRef.current) {
      playGameOver();
      lastGameOverRef.current = true;
    }

    const playerIds = players.map((p) => p.id);

    // Process each player
    players.forEach((p) => {
      const input = getInput(p.id);
      const pos = gameState.current.positions[p.id];

      if (!input || !pos) return;

      const isDoingTask = taskManagerRef.current.isDoingTask(p.id);
      const breakroomActivity = breakroomActivitiesRef.current[p.id];

      // Update task progress for busy players
      if (isDoingTask) {
        const progress = taskManagerRef.current.getTaskProgress(p.id);
        actionsRef.current.setTaskProgress({ playerId: p.id, progress });
      } else if (breakroomActivity) {
        // Update breakroom activity progress
        const elapsed = currentTime - breakroomActivity.startTime;
        const progress = Math.min(
          elapsed / STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS,
          1,
        );
        actionsRef.current.setTaskProgress({ playerId: p.id, progress });
      }

      // Handle movement if not doing a task
      if (!isDoingTask) {
        handlePlayerMovement(p.id, input, playerIds);
      }

      // Handle action button press (rising edge)
      if (input.action && !gameState.current.lastAction[p.id]) {
        // Try to start a task first
        const taskStarted = handleTaskStart(p.id, pos, LOCATIONS);
        if (!taskStarted) {
          // Try breakroom action
          handleBreakroomAction(p.id, pos, currentTime);
        }
      }

      // Check for completed tasks
      handleTaskComplete(p.id);

      // Check for completed breakroom activities
      handleBreakroomActivityComplete(p.id, currentTime);

      // Update player stats once per second
      if (currentTime - lastStatUpdateRef.current > 1000) {
        updatePlayerStats(p.id, currentTime);
      }

      // Store last action state
      gameState.current.lastAction[p.id] = input.action;
    });

    // Update stat decay timer once per second
    if (currentTime - lastStatUpdateRef.current > 1000) {
      lastStatUpdateRef.current = currentTime;
    }

    // Check if all players are dead (game over)
    const allPlayersDead =
      players.length > 0 &&
      players.every((p) => {
        const stats = gameState.current.playerStats[p.id];
        return stats && !stats.alive;
      });

    if (allPlayersDead && !gameOver) {
      actionsRef.current.setGameOver({ gameOver: true });
    }
  };

  const startMatch = (): void => {
    const now = Date.now();
    actionsRef.current.setGameOver({ gameOver: false });
    actionsRef.current.setGameStartTime({ startTime: now });
    taskManagerRef.current.reset();
    pendingTasksRef.current = [];
    lastTaskUpdateRef.current = now;
    lastStatUpdateRef.current = now;
    lastTaskCountRef.current = 0;
    lastGameOverRef.current = false;
    Object.keys(breakroomActivitiesRef.current).forEach((playerId) => {
      breakroomActivitiesRef.current[playerId] = null;
    });
  };

  /**
   * Reset the game state.
   */
  const resetGame = (playerIds: string[]) => {
    actionsRef.current.resetGame();
    actionsRef.current.setGameStartTime({ startTime: Date.now() });
    taskManagerRef.current.reset();

    // Reset player positions and state
    playerIds.forEach((playerId) => {
      delete gameState.current.positions[playerId];
      delete gameState.current.lastAction[playerId];
      delete gameState.current.playerAssignments[playerId];
      delete gameState.current.playerStats[playerId];
      breakroomActivitiesRef.current[playerId] = null;
      playerBoredomDecayTimers.current[playerId] = 0;
    });

    // Clear used spawn positions so they can be reused
    gameState.current.usedSpawnIndices.clear();
    
    // Reset sound tracking refs
    lastTaskCountRef.current = 0;
    lastGameOverRef.current = false;
  };

  return {
    gameStateRef: gameState,
    taskManagerRef,
    pendingTasksRef,
    lastTaskUpdateRef,
    lastStatUpdateRef,
    playerBoredomDecayTimers,
    breakroomActivitiesRef,
    playerImagesRef,
    locationImagesRef,
    money,
    gameOver,
    totalMoney,
    finalTotalMoney,
    timeRemaining,
    initializePlayers,
    loadPlayerImages,
    loadLocationImages,
    updateGame,
    startMatch,
    resetGame,
  };
}
