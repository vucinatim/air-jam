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
  <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-xs tracking-[0.24em] text-zinc-500 uppercase">
        Air Jam
      </div>
      <div className="text-3xl font-black tracking-[0.12em] text-white uppercase">
        Pong
      </div>
      <div className="text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
        Loading match surface
      </div>
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
