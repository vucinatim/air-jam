/**
 * Entry point. Mounts the React tree and the Air Jam-aware router basename so
 * the arcade shell can embed this game under its own path without breaking
 * routing. All the Air Jam wiring happens inside `./app` via `airjam.config.ts`.
 */
import { resolveAirJamBrowserRouterBasename } from "@air-jam/sdk";
import "@air-jam/sdk/styles.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <BrowserRouter
    basename={resolveAirJamBrowserRouterBasename()}
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <App />
  </BrowserRouter>,
);
