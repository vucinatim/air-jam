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
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#fdf6e3] text-[#5b4636]">
      <div className="text-xs uppercase tracking-[0.2em] opacity-70">
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
    </>
  );
}
