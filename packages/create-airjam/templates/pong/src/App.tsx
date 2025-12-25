import { AirJamProvider } from "@air-jam/sdk";
import { Route, Routes } from "react-router-dom";
import { ControllerView } from "./ControllerView";
import { HostView } from "./HostView";
import { gameInputSchema } from "./types";

export function App() {
  return (
    <AirJamProvider
      controllerPath="/joypad"
      input={{
        schema: gameInputSchema,
        latch: {
          booleanFields: ["action"],
        },
      }}
    >
      <Routes>
        <Route path="/" element={<HostView />} />
        <Route path="/joypad" element={<ControllerView />} />
      </Routes>
    </AirJamProvider>
  );
}
