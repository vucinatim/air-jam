import { AirJamProvider } from "@air-jam/sdk";
import type { JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { gameInputSchema } from "./game/types";
import { ControllerView } from "./routes/controller-view";
import { HostView } from "./routes/host-view";

export const App = (): JSX.Element => (
  <AirJamProvider
    serverUrl={import.meta.env.VITE_AIR_JAM_SERVER_URL}
    input={{
      schema: gameInputSchema,
      latch: {
        booleanFields: ["action", "ability"],
        vectorFields: ["vector"],
      },
    }}
  >
    <Routes>
      <Route path="/" element={<HostView />} />
      <Route path="/controller" element={<ControllerView />} />
    </Routes>
  </AirJamProvider>
);
