import { createAirJamApp, env } from "@air-jam/sdk";
import type { JSX } from "react";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";
const app = createAirJamApp(airjam, { runtime: env.vite(import.meta.env) });
const PrefabStage = lazy(async () => {
  const module = await import("./prefab-stage");
  return { default: module.PrefabStage };
});

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

const InspectionStage = () => (
  <Suspense fallback={<RouteFallback />}>
    <PrefabStage />
  </Suspense>
);

export const App = (): JSX.Element => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <app.Host prefabStage={InspectionStage}>
            <Suspense fallback={<RouteFallback />}>
              <HostView />
            </Suspense>
          </app.Host>
        }
      />
      <Route
        path={app.paths.controller}
        element={
          <app.Controller>
            <Suspense fallback={<RouteFallback />}>
              <ControllerView />
            </Suspense>
          </app.Controller>
        }
      />
    </Routes>
  );
};
