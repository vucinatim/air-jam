import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ArcadeGame } from "./arcade-system";

/** Browser vs game “mode” for the arcade shell lives in `ArcadeSurfaceState.kind` (replicated). This reducer only tracks host-local launch mechanics (selection, tokens, URLs). */
export interface ArcadeRuntimeState {
  selectedIndex: number;
  normalizedGameUrl: string;
  joinToken: string | null;
  isLaunching: boolean;
  consumedAutoLaunchRequestKey: string | null;
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

export const getAutoLaunchRequestKey = ({
  mode,
  autoLaunch,
  initialGameId,
}: {
  mode: "arcade" | "preview";
  autoLaunch: boolean;
  initialGameId?: string;
}): string | null => {
  if (mode === "preview") {
    return `preview:${initialGameId ?? "__first__"}`;
  }

  if (!autoLaunch || !initialGameId) {
    return null;
  }

  return `arcade:${initialGameId}`;
};

export const shouldAutoLaunchGame = ({
  autoLaunchRequestKey,
  consumedAutoLaunchRequestKey,
  isConnected,
  roomId,
  surfaceKind,
  isLaunching,
  hasJoinToken,
  gamesLength,
}: {
  autoLaunchRequestKey: string | null;
  consumedAutoLaunchRequestKey: string | null;
  isConnected: boolean;
  roomId?: string | null;
  /** From replicated `ArcadeSurfaceState.kind` — not runtime `activeGameId`. */
  surfaceKind: "browser" | "game";
  isLaunching: boolean;
  hasJoinToken: boolean;
  gamesLength: number;
}): boolean => {
  return (
    autoLaunchRequestKey != null &&
    consumedAutoLaunchRequestKey !== autoLaunchRequestKey &&
    isConnected &&
    !!roomId &&
    gamesLength > 0 &&
    surfaceKind === "browser" &&
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
      normalizedGameUrl: string;
      joinToken: string;
    }
  | { type: "launch-failure" }
  | { type: "exit-game"; exitedAt: number }
  | { type: "consume-auto-launch"; requestKey: string };

export const createInitialArcadeRuntimeState = ({
  games,
  initialGameId,
}: {
  games: ArcadeGame[];
  initialGameId?: string;
}): ArcadeRuntimeState => ({
  selectedIndex: getInitialSelectedIndex(games, initialGameId),
  normalizedGameUrl: "",
  joinToken: null,
  isLaunching: false,
  consumedAutoLaunchRequestKey: null,
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
        isLaunching: false,
        normalizedGameUrl: action.normalizedGameUrl,
        joinToken: action.joinToken,
      };

    case "launch-failure":
      return {
        ...state,
        isLaunching: false,
        consumedAutoLaunchRequestKey: null,
      };

    case "exit-game":
      return {
        ...state,
        normalizedGameUrl: "",
        joinToken: null,
        isLaunching: false,
        lastExitAt: action.exitedAt,
      };

    case "consume-auto-launch":
      return {
        ...state,
        consumedAutoLaunchRequestKey: action.requestKey,
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
    createInitialArcadeRuntimeState({ games, initialGameId }),
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const selectedGame = useMemo(() => {
    return games[state.selectedIndex] ?? null;
  }, [games, state.selectedIndex]);

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
    if (snapshot.isLaunching || snapshot.joinToken) {
      return false;
    }

    dispatch({ type: "launch-start" });
    return true;
  }, []);

  const completeLaunch = useCallback(
    ({
      normalizedGameUrl,
      joinToken,
    }: {
      normalizedGameUrl: string;
      joinToken: string;
    }) => {
      dispatch({
        type: "launch-success",
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

  const consumeAutoLaunch = useCallback((requestKey: string) => {
    dispatch({ type: "consume-auto-launch", requestKey });
  }, []);

  return {
    state,
    stateRef,
    selectedGame,
    setSelectedIndex,
    moveSelection,
    beginLaunch,
    completeLaunch,
    failLaunch,
    exitGame,
    consumeAutoLaunch,
  };
};
