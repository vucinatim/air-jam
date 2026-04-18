/**
 * Entry point. Mounts the React tree + the Air Jam-aware router basename so
 * the Arcade shell can embed this game under its own path without breaking
 * routing. All actual Air Jam wiring happens inside `./app`.
 */
import "@air-jam/sdk/styles.css";
import { resolveAirJamBrowserRouterBasename } from "@air-jam/sdk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={resolveAirJamBrowserRouterBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
