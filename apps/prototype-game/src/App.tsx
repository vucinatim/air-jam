import type { JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";
import { ControllerView } from "./routes/controller-view";
import { HostView } from "./routes/host-view";

export const App = (): JSX.Element => {
  return (
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
  );
};
