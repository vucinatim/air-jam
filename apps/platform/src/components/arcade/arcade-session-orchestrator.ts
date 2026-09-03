import { normalizeRuntimeUrl } from "@air-jam/sdk/arcade/url";
import type {
  ChildHostCapability,
  HostArcadeSessionSnapshot,
  SystemLaunchGameAck,
} from "@air-jam/sdk/protocol";
import type {
  ArcadeGame,
  ArcadeOverlayKind,
  ArcadeSurfaceKind,
} from "./arcade-surface-types";

export type ArcadeMode = "arcade" | "preview";

export type ArcadeHostRouteIntent =
  | { kind: "browser" }
  | { kind: "game"; gameId: string | null };

type LaunchContext = {
  game: ArcadeGame;
  normalizedGameUrl: string;
  controllerUrl: string;
  ensureBrowserBackTarget: boolean;
};

export type ArcadeSessionEffect =
  | { type: "runtime.reset" }
  | { type: "runtime.launch-start" }
  | { type: "runtime.launch-failure" }
  | {
      type: "runtime.launch-success";
      normalizedGameUrl: string;
      launchCapability: ChildHostCapability;
    }
  | { type: "runtime.exit" }
  | { type: "surface.reset"; mode: ArcadeMode }
  | { type: "surface.browser" }
  | {
      type: "surface.game";
      gameId: string;
      controllerUrl: string;
    }
  | { type: "surface.overlay"; overlay: ArcadeOverlayKind }
  | { type: "selection.set"; index: number }
  | { type: "history.browser" }
  | {
      type: "history.game";
      game: ArcadeGame;
      ensureBrowserBackTarget: boolean;
    }
  | { type: "server.close" }
  | { type: "server.launch"; context: LaunchContext }
  | { type: "restore.clear" };

export type ArcadeSessionEvent =
  | {
      type: "room.connected";
      roomId: string | null;
      connected: boolean;
      previousRoomId: string | null;
      restorePhase: "idle" | "awaiting_ack" | "pending_restore";
      mode: ArcadeMode;
      initialOverlay: ArcadeOverlayKind;
    }
  | {
      type: "launch.requested";
      game: ArcadeGame;
      connected: boolean;
      roomId: string | null;
      runtimeLaunchAvailable: boolean;
      mode: ArcadeMode;
      hostRouteIntent: ArcadeHostRouteIntent;
    }
  | {
      type: "launch.acknowledged";
      context: LaunchContext;
      ack: SystemLaunchGameAck;
      mode: ArcadeMode;
    }
  | {
      type: "restore.requested";
      session: HostArcadeSessionSnapshot;
      hostRouteIntent: ArcadeHostRouteIntent;
      games: ArcadeGame[];
      gamesCatalogReady: boolean;
      mode: ArcadeMode;
      browserOverlay: ArcadeOverlayKind;
    }
  | {
      type: "close.requested";
      mode: ArcadeMode;
      browserOverlay: ArcadeOverlayKind;
      notifyServer: boolean;
    }
  | {
      type: "history.back";
      mode: ArcadeMode;
      historySurface: "browser" | "game" | "outside";
      surfaceKind: ArcadeSurfaceKind;
      browserOverlay: ArcadeOverlayKind;
    };

const planClose = ({
  mode,
  browserOverlay,
  notifyServer,
}: {
  mode: ArcadeMode;
  browserOverlay: ArcadeOverlayKind;
  notifyServer: boolean;
}): ArcadeSessionEffect[] => [
  ...(mode === "arcade" ? ([{ type: "history.browser" }] as const) : []),
  { type: "surface.browser" },
  { type: "surface.overlay", overlay: browserOverlay },
  { type: "runtime.exit" },
  ...(notifyServer ? ([{ type: "server.close" }] as const) : []),
];

const planRejectedRestore = ({
  mode,
  browserOverlay,
}: {
  mode: ArcadeMode;
  browserOverlay: ArcadeOverlayKind;
}): ArcadeSessionEffect[] => [
  ...(mode === "arcade" ? ([{ type: "history.browser" }] as const) : []),
  { type: "surface.browser" },
  { type: "surface.overlay", overlay: browserOverlay },
  { type: "runtime.reset" },
  { type: "server.close" },
  { type: "restore.clear" },
];

export const orchestrateArcadeSession = (
  event: ArcadeSessionEvent,
): ArcadeSessionEffect[] => {
  switch (event.type) {
    case "room.connected": {
      if (!event.connected || !event.roomId) {
        return [];
      }
      if (event.previousRoomId === event.roomId) {
        return [];
      }

      const effects: ArcadeSessionEffect[] = [{ type: "runtime.reset" }];
      const changedRooms =
        event.previousRoomId !== null && event.previousRoomId !== event.roomId;
      if (changedRooms || event.restorePhase !== "pending_restore") {
        effects.push(
          { type: "surface.reset", mode: event.mode },
          { type: "surface.overlay", overlay: event.initialOverlay },
        );
      }
      return effects;
    }

    case "launch.requested": {
      if (!event.connected || !event.roomId || !event.runtimeLaunchAvailable) {
        return [];
      }

      const normalizedGameUrl = normalizeRuntimeUrl(event.game.url);
      const controllerUrl = normalizeRuntimeUrl(event.game.controllerUrl);
      if (!normalizedGameUrl || !controllerUrl) {
        return [
          { type: "runtime.launch-start" },
          { type: "runtime.launch-failure" },
        ];
      }

      return [
        { type: "runtime.launch-start" },
        {
          type: "server.launch",
          context: {
            game: event.game,
            normalizedGameUrl,
            controllerUrl,
            ensureBrowserBackTarget: event.hostRouteIntent.kind === "game",
          },
        },
      ];
    }

    case "launch.acknowledged": {
      if (!event.ack.ok || !event.ack.launchCapability) {
        return [{ type: "runtime.launch-failure" }];
      }

      return [
        {
          type: "surface.game",
          gameId: event.context.game.id,
          controllerUrl: event.context.controllerUrl,
        },
        { type: "surface.overlay", overlay: "hidden" },
        {
          type: "runtime.launch-success",
          normalizedGameUrl: event.context.normalizedGameUrl,
          launchCapability: event.ack.launchCapability,
        },
        ...(event.mode === "arcade"
          ? ([
              {
                type: "history.game",
                game: event.context.game,
                ensureBrowserBackTarget: event.context.ensureBrowserBackTarget,
              },
            ] as const)
          : []),
      ];
    }

    case "restore.requested": {
      if (event.hostRouteIntent.kind === "browser") {
        return planRejectedRestore(event);
      }
      if (
        event.hostRouteIntent.gameId &&
        event.session.gameId !== event.hostRouteIntent.gameId
      ) {
        return planRejectedRestore(event);
      }

      const game =
        event.games.find(
          (candidate) => candidate.id === event.session.gameId,
        ) ?? null;
      if (!game) {
        return event.gamesCatalogReady ? planRejectedRestore(event) : [];
      }

      const normalizedGameUrl = normalizeRuntimeUrl(game.url);
      const controllerUrl = normalizeRuntimeUrl(game.controllerUrl);
      if (!normalizedGameUrl || !controllerUrl) {
        return planRejectedRestore(event);
      }

      const index = event.games.findIndex(
        (candidate) => candidate.id === game.id,
      );
      return [
        { type: "surface.game", gameId: game.id, controllerUrl },
        { type: "surface.overlay", overlay: "hidden" },
        {
          type: "runtime.launch-success",
          normalizedGameUrl,
          launchCapability: event.session.launchCapability,
        },
        ...(index >= 0 ? ([{ type: "selection.set", index }] as const) : []),
        ...(event.mode === "arcade"
          ? ([
              {
                type: "history.game",
                game,
                ensureBrowserBackTarget: event.hostRouteIntent.kind === "game",
              },
            ] as const)
          : []),
        { type: "restore.clear" },
      ];
    }

    case "close.requested":
      return planClose(event);

    case "history.back":
      if (
        event.mode !== "arcade" ||
        event.historySurface !== "browser" ||
        event.surfaceKind !== "game"
      ) {
        return [];
      }
      return planClose({
        mode: event.mode,
        browserOverlay: event.browserOverlay,
        notifyServer: true,
      });
  }
};
