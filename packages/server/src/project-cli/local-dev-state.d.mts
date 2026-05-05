export type AirJamManagedDevProcess = {
  id: string;
  pid: number;
  cwd: string;
  projectMode: "monorepo" | "standalone-game";
  mode: "standalone-dev" | "arcade-dev" | "arcade-test";
  topologyMode: "standalone-dev" | "arcade-live" | "arcade-built";
  secure: boolean;
  gameId: string | null;
  command: string;
  args: string[];
  logPath: string;
  expectedLogPath: string | null;
  startedAt: string;
};

export type AirJamUnmanagedDevProcess = {
  pid: number;
  ports: number[];
  command: string | null;
  startedAt: string | null;
  ageMs: number | null;
  managed: false;
};

export type AirJamDevStatus = {
  processes: AirJamManagedDevProcess[];
  unmanagedProcesses: AirJamUnmanagedDevProcess[];
  knownPorts: number[];
};

export type ResetLocalDevResult = {
  stoppedManaged: AirJamManagedDevProcess[];
  stoppedUnmanaged: AirJamUnmanagedDevProcess[];
  remainingUnmanaged: AirJamUnmanagedDevProcess[];
  knownPorts: number[];
};

export declare const getDevStatus: (options?: {
  cwd?: string;
}) => Promise<AirJamDevStatus>;

export declare const resetLocalDev: (options?: {
  cwd?: string;
}) => Promise<ResetLocalDevResult>;
