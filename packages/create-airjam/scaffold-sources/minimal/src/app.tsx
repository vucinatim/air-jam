/**
 * Route shell. Host + controller views are lazy-loaded so each surface only
 * pulls the code it needs. The real surfaces live in `./host` and
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

const LoadingScreen = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-300">
    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
      Loading
    </div>
  </div>
);

export function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
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
