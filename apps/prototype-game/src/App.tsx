import type { JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { ControllerView } from "./routes/controller-view";
import { HostView } from "./routes/host-view";

export const App = (): JSX.Element => (
  <Routes>
    <Route path="/" element={<HostView />} />
    <Route path="/joypad" element={<ControllerView />} />
  </Routes>
);
