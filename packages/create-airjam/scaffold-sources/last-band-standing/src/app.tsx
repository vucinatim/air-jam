import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";

export const App = () => {
  const HostView = lazy(async () => {
    const module = await import("./host");
    return { default: module.HostView };
  });

  const ControllerView = lazy(async () => {
    const module = await import("./controller");
    return { default: module.ControllerView };
  });

  const YoutubeTestPage = lazy(async () => {
    const module = await import("./routes/youtube-test-page");
    return { default: module.YoutubeTestPage };
  });

  return (
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
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
        <Route path="/youtube-test" element={<YoutubeTestPage />} />
      </Routes>
    </Suspense>
  );
};
