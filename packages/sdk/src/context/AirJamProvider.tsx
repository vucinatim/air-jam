import React, { createContext, useContext, useMemo, useEffect } from "react";
import { AirJamClient } from "../AirJamClient";

export interface AirJamProviderProps {
  apiKey?: string;
  serverUrl?: string;
  role: "host" | "controller";
  children: React.ReactNode;
}

const AirJamContext = createContext<AirJamClient | null>(null);

/**
 * Provider that establishes an Air Jam session and distributes it via context.
 */
export const AirJamProvider: React.FC<AirJamProviderProps> = ({
  apiKey,
  serverUrl,
  role,
  children,
}) => {
  // 1. Initialize the Engine (Client)
  // We use useMemo to ensure the client is only created once per mount/config change.
  const client = useMemo(() => {
    console.log(`[AirJamProvider] Initializing AirJamClient for role: ${role}`);
    return new AirJamClient({ apiKey, serverUrl, role });
  }, [apiKey, serverUrl, role]);

  // 2. Lifecycle: Auto-connect & Auto-disconnect
  useEffect(() => {
    client.connect();
    
    return () => {
      console.log(`[AirJamProvider] Destroying AirJamClient for role: ${role}`);
      client.destroy();
    };
  }, [client, role]);

  return (
    <AirJamContext.Provider value={client}>
      {children}
    </AirJamContext.Provider>
  );
};

/**
 * Internal hook to consume the Air Jam engine.
 */
export const useAirJamContext = () => {
  const context = useContext(AirJamContext);
  if (!context) {
    throw new Error("Air Jam hooks must be used within an <AirJamProvider />");
  }
  return context;
};
