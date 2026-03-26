import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";

const HostView = lazy(async () => {
  const module = await import("./game/host");
  return { default: module.HostView };
});

const ControllerView = lazy(async () => {
  const module = await import("./game/controller");
  return { default: module.ControllerView };
});

export function App() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
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
