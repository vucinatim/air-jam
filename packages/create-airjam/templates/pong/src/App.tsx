import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";
import { ControllerView } from "./game/controller";
import { HostView } from "./game/host";

export function App() {
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
}
