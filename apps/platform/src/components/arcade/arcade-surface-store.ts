import {
  createAirJamStore,
  type AirJamActionContext,
} from "@air-jam/sdk";
import { AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN } from "@air-jam/sdk/arcade/surface";
import {
  createInitialArcadeSurfaceState,
  type ArcadeOverlayKind,
  type ArcadeSurfaceState,
} from "./arcade-surface-types";

interface ArcadeSurfaceStoreState extends ArcadeSurfaceState {
  actions: {
    /** Host: reset surface when entering a new room / Arcade session. */
    resetHostSurfaceForMode: (
      ctx: AirJamActionContext,
      payload: { mode: "arcade" | "preview" },
    ) => void;
    /** Host: browser surface; bumps epoch when leaving a game surface. */
    setBrowserSurface: (
      ctx: AirJamActionContext,
      payload: undefined,
    ) => void;
    /** Host: active game surface; always bumps epoch (incl. game A → game B). */
    setGameSurface: (
      ctx: AirJamActionContext,
      payload: {
        gameId: string;
        controllerUrl: string;
        orientation: "portrait" | "landscape";
      },
    ) => void;
    /** Host: overlay only; does not bump epoch. */
    setOverlay: (
      ctx: AirJamActionContext,
      payload: { overlay: ArcadeOverlayKind },
    ) => void;
    /** Host: toggle QR overlay in browser (coarse platform UX). */
    toggleQrOverlay: (ctx: AirJamActionContext, payload: undefined) => void;
  };
}

const assertHost = (ctx: AirJamActionContext): boolean =>
  ctx.role === "host";

export const useArcadeSurfaceStore = createAirJamStore<ArcadeSurfaceStoreState>(
  (set) => ({
    ...createInitialArcadeSurfaceState({ mode: "arcade" }),
    actions: {
      resetHostSurfaceForMode: (ctx, { mode }) => {
        if (!assertHost(ctx)) {
          return;
        }
        set(() => createInitialArcadeSurfaceState({ mode }));
      },

      setBrowserSurface: (ctx, _payload) => {
        if (!assertHost(ctx)) {
          return;
        }
        set((s) => {
          if (s.kind === "browser") {
            return {
              ...s,
              gameId: null,
              controllerUrl: null,
              orientation: "portrait",
            };
          }
          return {
            ...s,
            epoch: s.epoch + 1,
            kind: "browser",
            gameId: null,
            controllerUrl: null,
            orientation: "portrait",
          };
        });
      },

      setGameSurface: (ctx, payload) => {
        if (!assertHost(ctx)) {
          return;
        }
        set((s) => ({
          ...s,
          epoch: s.epoch + 1,
          kind: "game",
          gameId: payload.gameId,
          controllerUrl: payload.controllerUrl,
          orientation: payload.orientation,
        }));
      },

      setOverlay: (ctx, payload) => {
        if (!assertHost(ctx)) {
          return;
        }
        set({ overlay: payload.overlay });
      },

      toggleQrOverlay: (ctx, _payload) => {
        if (!assertHost(ctx)) {
          return;
        }
        set((s) => ({
          ...s,
          overlay: s.overlay === "qr" ? "hidden" : "qr",
        }));
      },
    },
  }),
  { storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN },
);
