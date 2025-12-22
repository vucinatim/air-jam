// Context & Provider (primary API)
export * from "./context";

// Audio
export * from "./audio";

// Components
export * from "./components/air-jam-overlay";
export * from "./components/controller-shell";
export * from "./components/ui/button";
export * from "./components/ui/slider";
export * from "./components/volume-controls";

// Constants
export * from "./constants";

// Events
export * from "./events";

// Hooks
export * from "./hooks/use-air-jam-controller";
export * from "./hooks/use-air-jam-haptics";
export * from "./hooks/use-air-jam-host";
export * from "./hooks/use-air-jam-host-signal";
export * from "./hooks/use-air-jam-input";
export * from "./hooks/use-air-jam-input-latch";
export * from "./hooks/use-air-jam-shell";

// Protocol types
export * from "./protocol";

// Socket client (legacy - prefer using context)
export * from "./socket-client";

// State (legacy global store - prefer using context)
export * from "./state/connection-store";

// Utilities
export * from "./utils/ids";
export * from "./utils/network-ip";
export * from "./utils/url-builder";
