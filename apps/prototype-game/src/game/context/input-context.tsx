/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import type { GameLoopInput } from "../types";

type GetInputFn = (controllerId: string) => GameLoopInput | undefined;

const InputContext = createContext<GetInputFn | null>(null);

export const InputProvider = ({
  getInput,
  children,
}: {
  getInput: GetInputFn;
  children: ReactNode;
}) => {
  return (
    <InputContext.Provider value={getInput}>{children}</InputContext.Provider>
  );
};

export const useInputContext = (): GetInputFn | null => {
  return useContext(InputContext);
};
