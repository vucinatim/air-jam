/**
 * Route shell. The host + controller views are lazy-loaded so each surface
 * only pulls the code it needs. The real work happens inside `./host` and
 * `./controller`, both wrapped by the lifecycle providers from
 * `airjam.config.ts`.
 */
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
      <div className="text-xs tracking-[0.2em] text-neutral-500 uppercase">
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
              <HostView />
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
}
