import { createAirJamApp, env } from "@air-jam/sdk";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";

const app = createAirJamApp(airjam, { runtime: env.vite(import.meta.env) });

const HostView = lazy(async () => {
  const module = await import("./host");
  return { default: module.HostView };
});

const ControllerView = lazy(async () => {
  const module = await import("./controller");
  return { default: module.ControllerView };
});

const RouteFallback = () => {
  return <div className="bg-background h-screen w-screen" />;
};

export const App = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <app.Host>
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
