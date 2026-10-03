import type {
  ArcadeBrowserDirection,
  ChildHostCapability,
} from "@air-jam/sdk/protocol";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ArcadeGame } from "./arcade-surface-types";

/** Browser vs game “mode” for the arcade shell lives in `ArcadeSurfaceState.kind` (replicated). This reducer only tracks host-local launch mechanics (selection, tokens, URLs). */
export interface ArcadeRuntimeState {
  selectedIndex: number;
  normalizedGameUrl: string;
  launchCapability: ChildHostCapability | null;
  isLaunching: boolean;
  launchFailed: boolean;
  consumedAutoLaunchRequestKey: string | null;
  lastExitAt: number;
}

export const EXIT_COOLDOWN_MS = 500;
export const ARCADE_BROWSER_PATH = "/arcade";

export type ArcadeHistorySurface = "browser" | "game" | "outside";

export const getArcadeGameHistoryPath = (game: ArcadeGame): string =>
  `${ARCADE_BROWSER_PATH}/${game.slug || game.id}`;

export const normalizeArcadeHistoryPathname = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

export const getArcadeHistorySurface = (
  pathname: string,
): ArcadeHistorySurface => {
  const normalizedPathname = normalizeArcadeHistoryPathname(pathname);

  if (normalizedPathname === ARCADE_BROWSER_PATH) {
    return "browser";
  }

  if (normalizedPathname.startsWith(`${ARCADE_BROWSER_PATH}/`)) {
    return "game";
  }

  return "outside";
};

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
  direction,
  columns,
  gamesLength,
}: {
  selectedIndex: number;
  direction: ArcadeBrowserDirection;
  columns: number;
  gamesLength: number;
}): number => {
  if (gamesLength <= 0) {
    return 0;
  }

  selectedIndex = clampSelectedIndex(selectedIndex, gamesLength);
  columns = Math.max(1, Math.floor(columns));

  if (direction === "up") {
    const nextIndex = selectedIndex - columns;
    if (nextIndex < 0) {
      const currentColumn = selectedIndex % columns;
      const lastRow = Math.floor((gamesLength - 1) / columns);
      return Math.min(lastRow * columns + currentColumn, gamesLength - 1);
    }
    return nextIndex;
  }

  if (direction === "down") {
    const nextIndex = selectedIndex + columns;
    if (nextIndex >= gamesLength) {
      return selectedIndex % columns;
    }
    return nextIndex;
  }

  if (direction === "left") {
    const nextIndex = selectedIndex - 1;
    return nextIndex < 0 ? gamesLength - 1 : nextIndex;
  }

  if (direction === "right") {
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
  hasLaunchCapability,
  gamesLength,
}: {
  autoLaunchRequestKey: string | null;
  consumedAutoLaunchRequestKey: string | null;
  isConnected: boolean;
  roomId?: string | null;
  /** From replicated `ArcadeSurfaceState.kind` — not runtime `activeGameId`. */
  surfaceKind: "browser" | "game";
  isLaunching: boolean;
  hasLaunchCapability: boolean;
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
    !hasLaunchCapability
  );
};

type RuntimeAction =
  | { type: "select"; index: number; gamesLength: number }
  | {
      type: "move";
      direction: ArcadeBrowserDirection;
      columns: number;
      gamesLength: number;
    }
  | { type: "launch-start" }
  | {
      type: "launch-success";
      normalizedGameUrl: string;
      launchCapability: ChildHostCapability;
    }
  | { type: "launch-failure" }
  | { type: "exit-game"; exitedAt: number }
  | { type: "reset-session" }
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
  launchCapability: null,
  isLaunching: false,
  launchFailed: false,
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
          direction: action.direction,
          columns: action.columns,
          gamesLength: action.gamesLength,
        }),
      };

    case "launch-start":
      return {
        ...state,
        isLaunching: true,
        launchFailed: false,
      };

    case "launch-success":
      return {
        ...state,
        isLaunching: false,
        launchFailed: false,
        normalizedGameUrl: action.normalizedGameUrl,
        launchCapability: action.launchCapability,
      };

    case "launch-failure":
      return {
        ...state,
        isLaunching: false,
        launchFailed: true,
        // A rejected deep-link launch waits for an explicit retry, not a render loop.
      };

    case "exit-game":
      return {
        ...state,
        normalizedGameUrl: "",
        launchCapability: null,
        isLaunching: false,
        lastExitAt: action.exitedAt,
        launchFailed: false,
      };

    case "reset-session":
      return {
        ...state,
        normalizedGameUrl: "",
        launchCapability: null,
        isLaunching: false,
        consumedAutoLaunchRequestKey: null,
        launchFailed: false,
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
  const [state, setState] = useState(() =>
    createInitialArcadeRuntimeState({ games, initialGameId }),
  );

  const stateRef = useRef(state);
  // Socket commands can arrive back-to-back before React renders. Reduce once,
  // synchronously, so selection and launch admission share the same state.
  const dispatch = useCallback((action: RuntimeAction) => {
    const next = reduceArcadeRuntimeState(stateRef.current, action);
    stateRef.current = next;
    setState(next);
  }, []);

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
    [dispatch, games.length],
  );

  const moveSelection = useCallback(
    (direction: ArcadeBrowserDirection, columns: number) => {
      dispatch({
        type: "move",
        direction,
        columns,
        gamesLength: games.length,
      });
    },
    [dispatch, games.length],
  );

  const beginLaunch = useCallback((): boolean => {
    const snapshot = stateRef.current;
    if (snapshot.isLaunching || snapshot.launchCapability) {
      return false;
    }

    dispatch({ type: "launch-start" });
    return true;
  }, [dispatch]);

  const completeLaunch = useCallback(
    ({
      normalizedGameUrl,
      launchCapability,
    }: {
      normalizedGameUrl: string;
      launchCapability: ChildHostCapability;
    }) => {
      dispatch({
        type: "launch-success",
        normalizedGameUrl,
        launchCapability,
      });
    },
    [dispatch],
  );

  const failLaunch = useCallback(() => {
    dispatch({ type: "launch-failure" });
  }, [dispatch]);

  const resetSession = useCallback(() => {
    dispatch({ type: "reset-session" });
  }, [dispatch]);

  const exitGame = useCallback(() => {
    dispatch({ type: "exit-game", exitedAt: Date.now() });
    if (mode === "preview") {
      onExitGame?.();
    }
  }, [dispatch, mode, onExitGame]);

  const consumeAutoLaunch = useCallback(
    (requestKey: string) => {
      dispatch({ type: "consume-auto-launch", requestKey });
    },
    [dispatch],
  );

  return {
    state,
    stateRef,
    selectedGame,
    setSelectedIndex,
    moveSelection,
    beginLaunch,
    completeLaunch,
    failLaunch,
    resetSession,
    exitGame,
    consumeAutoLaunch,
  };
};
