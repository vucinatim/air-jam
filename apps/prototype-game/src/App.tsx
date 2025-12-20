import type { JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { ControllerView } from "./routes/controller-view";
import { HostView } from "./routes/host-view";
import { AirJamProvider } from "@air-jam/sdk";

export const App = (): JSX.Element => (
  <Routes>
    <Route
      path="/"
      element={
        <AirJamProvider
          role="host"
          serverUrl={import.meta.env.VITE_AIR_JAM_SERVER_URL}
          apiKey={import.meta.env.VITE_AIR_JAM_API_KEY}
        >
          <HostView />
        </AirJamProvider>
      }
    />
    <Route
      path="/joypad"
      element={
        <AirJamProvider
          role="controller"
          serverUrl={import.meta.env.VITE_AIR_JAM_SERVER_URL}
        >
          <ControllerView />
        </AirJamProvider>
      }
    />
  </Routes>
);
