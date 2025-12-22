/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import type {
  HapticSignalPayload,
  ToastSignalPayload,
} from "@air-jam/sdk";

type SendSignalFn = {
  (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
  (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
};

const SignalContext = createContext<SendSignalFn | null>(null);

export const SignalProvider = ({
  sendSignal,
  children,
}: {
  sendSignal: SendSignalFn;
  children: ReactNode;
}) => {
  return (
    <SignalContext.Provider value={sendSignal}>{children}</SignalContext.Provider>
  );
};

export const useSignalContext = (): SendSignalFn | null => {
  return useContext(SignalContext);
};

