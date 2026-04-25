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

const showYouTubeTestRoute =
  import.meta.env.DEV ||
  import.meta.env.VITE_ENABLE_YOUTUBE_TEST_ROUTE === "true";

const YoutubeTestPage = showYouTubeTestRoute
  ? lazy(async () => {
      const module = await import("./routes/youtube-test-page");
      return { default: module.YoutubeTestPage };
    })
  : null;

const RouteFallback = () => {
  return <div className="bg-background h-screen w-screen" />;
};

export const App = () => {
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
        {showYouTubeTestRoute && YoutubeTestPage ? (
          <Route path="/youtube-test" element={<YoutubeTestPage />} />
        ) : null}
      </Routes>
    </Suspense>
  );
};
