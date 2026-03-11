import { AirJamProvider } from "@air-jam/sdk";
import { Route, Routes } from "react-router-dom";
import { ControllerView } from "./controller-view";
import { HostView } from "./host-view";
import { gameInputSchema } from "./types";

export function App() {
  return (
    <AirJamProvider
      serverUrl={import.meta.env.VITE_AIR_JAM_SERVER_URL}
      publicHost={import.meta.env.VITE_AIR_JAM_PUBLIC_HOST}
      input={{
        schema: gameInputSchema,
        latch: {
          booleanFields: ["action"],
        },
      }}
    >
      <Routes>
        <Route path="/" element={<HostView />} />
        <Route path="/controller" element={<ControllerView />} />
      </Routes>
    </AirJamProvider>
  );
}
