import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ArcadeGame } from "./arcade-system";

export type ArcadeView = "browser" | "game";

export interface ArcadeRuntimeState {
  view: ArcadeView;
  selectedIndex: number;
  activeGameId: string | null;
  normalizedGameUrl: string;
  joinToken: string | null;
  isLaunching: boolean;
  hasAutoLaunched: boolean;
  lastExitAt: number;
}

export const EXIT_COOLDOWN_MS = 500;

export const getInitialSelectedIndex = (
  games: ArcadeGame[],
  initialGameId?: string,
): number => {
  if (!games.length) {
    return 0;
  }

  if (!initialGameId) {
    return 0;
  }

  const index = games.findIndex((game) => game.id === initialGameId);
  return index >= 0 ? index : 0;
};

export const clampSelectedIndex = (
  index: number,
  gamesLength: number,
): number => {
  if (gamesLength <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= gamesLength) {
    return gamesLength - 1;
  }

  return index;
};

export const getNextSelectedIndex = ({
  selectedIndex,
  vector,
  columns,
  gamesLength,
}: {
  selectedIndex: number;
  vector: { x: number; y: number };
  columns: number;
  gamesLength: number;
}): number => {
  if (gamesLength <= 0) {
    return 0;
  }

  if (vector.y < -0.5) {
    const nextIndex = selectedIndex - columns;
    if (nextIndex < 0) {
      const currentColumn = selectedIndex % columns;
      const lastRow = Math.floor((gamesLength - 1) / columns);
      return Math.min(lastRow * columns + currentColumn, gamesLength - 1);
    }
    return nextIndex;
  }

  if (vector.y > 0.5) {
    const nextIndex = selectedIndex + columns;
    if (nextIndex >= gamesLength) {
      return selectedIndex % columns;
    }
    return nextIndex;
  }

  if (vector.x < -0.5) {
    const nextIndex = selectedIndex - 1;
    return nextIndex < 0 ? gamesLength - 1 : nextIndex;
  }

  if (vector.x > 0.5) {
    const nextIndex = selectedIndex + 1;
    return nextIndex >= gamesLength ? 0 : nextIndex;
  }

  return selectedIndex;
};

export const shouldAutoLaunchGame = ({
  mode,
  autoLaunch,
  hasAutoLaunched,
  isConnected,
  roomId,
  hasActiveGame,
  isLaunching,
  hasJoinToken,
  gamesLength,
}: {
  mode: "arcade" | "preview";
  autoLaunch: boolean;
  hasAutoLaunched: boolean;
  isConnected: boolean;
  roomId?: string | null;
  hasActiveGame: boolean;
  isLaunching: boolean;
  hasJoinToken: boolean;
  gamesLength: number;
}): boolean => {
  const launchEnabled = mode === "preview" || autoLaunch;
  return (
    launchEnabled &&
    !hasAutoLaunched &&
    isConnected &&
    !!roomId &&
    gamesLength > 0 &&
    !hasActiveGame &&
    !isLaunching &&
    !hasJoinToken
  );
};

type RuntimeAction =
  | { type: "select"; index: number; gamesLength: number }
  | {
      type: "move";
      vector: { x: number; y: number };
      columns: number;
      gamesLength: number;
    }
  | { type: "launch-start" }
  | {
      type: "launch-success";
      gameId: string;
      normalizedGameUrl: string;
      joinToken: string;
    }
  | { type: "launch-failure" }
  | { type: "exit-game"; exitedAt: number }
  | { type: "mark-auto-launched" };

export const createInitialArcadeRuntimeState = ({
  games,
  mode,
  initialGameId,
}: {
  games: ArcadeGame[];
  mode: "arcade" | "preview";
  initialGameId?: string;
}): ArcadeRuntimeState => ({
  view: mode === "preview" ? "game" : "browser",
  selectedIndex: getInitialSelectedIndex(games, initialGameId),
  activeGameId: null,
  normalizedGameUrl: "",
  joinToken: null,
  isLaunching: false,
  hasAutoLaunched: false,
  lastExitAt: 0,
});

export const reduceArcadeRuntimeState = (
  state: ArcadeRuntimeState,
  action: RuntimeAction,
): ArcadeRuntimeState => {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selectedIndex: clampSelectedIndex(action.index, action.gamesLength),
      };

    case "move":
      return {
        ...state,
        selectedIndex: getNextSelectedIndex({
          selectedIndex: state.selectedIndex,
          vector: action.vector,
          columns: action.columns,
          gamesLength: action.gamesLength,
        }),
      };

    case "launch-start":
      return {
        ...state,
        isLaunching: true,
      };

    case "launch-success":
      return {
        ...state,
        view: "game",
        isLaunching: false,
        activeGameId: action.gameId,
        normalizedGameUrl: action.normalizedGameUrl,
        joinToken: action.joinToken,
      };

    case "launch-failure":
      return {
        ...state,
        isLaunching: false,
        hasAutoLaunched: false,
      };

    case "exit-game":
      return {
        ...state,
        view: "browser",
        activeGameId: null,
        normalizedGameUrl: "",
        joinToken: null,
        isLaunching: false,
        hasAutoLaunched: false,
        lastExitAt: action.exitedAt,
      };

    case "mark-auto-launched":
      return {
        ...state,
        hasAutoLaunched: true,
      };

    default:
      return state;
  }
};

export const useArcadeRuntimeManager = ({
  games,
  mode,
  initialGameId,
  onExitGame,
}: {
  games: ArcadeGame[];
  mode: "arcade" | "preview";
  initialGameId?: string;
  onExitGame?: () => void;
}) => {
  const [state, dispatch] = useReducer(
    reduceArcadeRuntimeState,
    createInitialArcadeRuntimeState({ games, mode, initialGameId }),
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const selectedGame = useMemo(() => {
    return games[state.selectedIndex] ?? null;
  }, [games, state.selectedIndex]);

  const activeGame = useMemo(() => {
    if (!state.activeGameId) {
      return null;
    }

    return games.find((game) => game.id === state.activeGameId) ?? null;
  }, [games, state.activeGameId]);

  const setSelectedIndex = useCallback(
    (index: number) => {
      dispatch({
        type: "select",
        index,
        gamesLength: games.length,
      });
    },
    [games.length],
  );

  const moveSelection = useCallback(
    (vector: { x: number; y: number }, columns: number) => {
      dispatch({
        type: "move",
        vector,
        columns,
        gamesLength: games.length,
      });
    },
    [games.length],
  );

  const beginLaunch = useCallback((): boolean => {
    const snapshot = stateRef.current;
    if (snapshot.isLaunching || snapshot.activeGameId || snapshot.joinToken) {
      return false;
    }

    dispatch({ type: "launch-start" });
    return true;
  }, []);

  const completeLaunch = useCallback(
    ({
      gameId,
      normalizedGameUrl,
      joinToken,
    }: {
      gameId: string;
      normalizedGameUrl: string;
      joinToken: string;
    }) => {
      dispatch({
        type: "launch-success",
        gameId,
        normalizedGameUrl,
        joinToken,
      });
    },
    [],
  );

  const failLaunch = useCallback(() => {
    dispatch({ type: "launch-failure" });
  }, []);

  const exitGame = useCallback(() => {
    dispatch({ type: "exit-game", exitedAt: Date.now() });
    if (mode === "preview") {
      onExitGame?.();
    }
  }, [mode, onExitGame]);

  const markAutoLaunched = useCallback(() => {
    dispatch({ type: "mark-auto-launched" });
  }, []);

  return {
    state,
    stateRef,
    selectedGame,
    activeGame,
    setSelectedIndex,
    moveSelection,
    beginLaunch,
    completeLaunch,
    failLaunch,
    exitGame,
    markAutoLaunched,
  };
};
