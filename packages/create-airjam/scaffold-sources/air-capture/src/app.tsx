import type { JSX } from "react";
import { Suspense, lazy, useMemo } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { airjam } from "./airjam.config";
import { HostAudioProvider } from "./game/audio/host-audio";
import "./game/register-abilities";
import {
  AIR_CAPTURE_PREFAB_CAPTURE_SURFACE,
  AIR_CAPTURE_PREFAB_CAPTURE_SURFACE_PARAM,
} from "./prefab-preview/params";

// Prefab-preview is dev-only tooling for the visual-harness capture lane.
// `import.meta.env.DEV` resolves to a compile-time boolean, so production
// builds tree-shake the lazy factory (and therefore the chunk for
// `./prefab-preview`) out of the bundle. Only the tiny params constants and
// the dead-branch guard below survive — the 255-LOC prefab surface does not
// ship to production.
const PrefabCaptureSurface = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("./prefab-preview");
      return { default: module.PrefabCaptureSurface };
    })
  : null;

const HostView = lazy(async () => {
  const module = await import("./host");
  return { default: module.HostView };
});

const ControllerView = lazy(async () => {
  const module = await import("./controller");
  return { default: module.ControllerView };
});

const RouteFallback = (): JSX.Element => {
  return <div className="h-screen w-screen bg-black" />;
};

const HostSurface = (): JSX.Element => {
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  if (
    import.meta.env.DEV &&
    PrefabCaptureSurface &&
    searchParams.get(AIR_CAPTURE_PREFAB_CAPTURE_SURFACE_PARAM) ===
      AIR_CAPTURE_PREFAB_CAPTURE_SURFACE
  ) {
    return (
      <HostAudioProvider muted={true}>
        <PrefabCaptureSurface />
      </HostAudioProvider>
    );
  }

  return <HostView />;
};

export const App = (): JSX.Element => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <airjam.Host>
              <HostSurface />
            </airjam.Host>
          }
        />
        <Route
          path={airjam.paths.controller}
          element={
            <airjam.Controller>
              <ControllerView />
            </airjam.Controller>
          }
        />
      </Routes>
    </Suspense>
  );
};
