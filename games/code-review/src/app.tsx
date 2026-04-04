import { PlatformSettingsRuntime } from "@air-jam/sdk";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";

const HostView = lazy(async () => {
  const module = await import("./host");
  return { default: module.HostView };
});

const ControllerView = lazy(async () => {
  const module = await import("./controller");
  return { default: module.ControllerView };
});

const RouteFallback = () => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-200">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        Loading match surface
      </div>
    </div>
  );
};

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <airjam.Host>
              <PlatformSettingsRuntime>
                <HostView />
              </PlatformSettingsRuntime>
            </airjam.Host>
          }
        />
        <Route
          path={airjam.paths.controller}
          element={
            <airjam.Controller>
              <PlatformSettingsRuntime>
                <ControllerView />
              </PlatformSettingsRuntime>
            </airjam.Controller>
          }
        />
      </Routes>
    </Suspense>
  );
}
