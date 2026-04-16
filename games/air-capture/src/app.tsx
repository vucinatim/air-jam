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

const HostView = lazy(async () => {
  const module = await import("./host");
  return { default: module.HostView };
});

const ControllerView = lazy(async () => {
  const module = await import("./controller");
  return { default: module.ControllerView };
});

const PrefabCaptureSurface = lazy(async () => {
  const module = await import("./prefab-preview");
  return { default: module.PrefabCaptureSurface };
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
