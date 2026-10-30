import { createAirJamApp, env } from "@air-jam/sdk";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
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
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--airjam-color-paper-cream)] text-[var(--airjam-color-text-muted-brown)]">
      <div className="text-xs tracking-[0.2em] uppercase opacity-70">
        Loading office floor
      </div>
    </div>
  );
};

export function App() {
  return (
    <>
      <Toaster position="bottom-right" theme="light" />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              <app.Host>
                <HostView />
              </app.Host>
            }
          />
          <Route
            path={app.paths.controller}
            element={
              <app.Controller>
                <ControllerView />
              </app.Controller>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}
