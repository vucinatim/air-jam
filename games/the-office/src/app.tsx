import { PlatformSettingsRuntime } from "@air-jam/sdk";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
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
  return <div className="h-screen w-screen bg-[#fdf6e3]" />;
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
    </>
  );
}
