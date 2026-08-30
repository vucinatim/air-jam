import crossSpawn from "cross-spawn";

type ManagedDevCommand = {
  command: string;
  args: string[];
  cwd: string;
};

const decodeCommand = (encoded: string | undefined): ManagedDevCommand => {
  if (!encoded) {
    throw new Error("Managed dev supervisor requires one command descriptor.");
  }

  const parsed = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Partial<ManagedDevCommand>;
  if (
    typeof parsed.command !== "string" ||
    parsed.command.trim() === "" ||
    !Array.isArray(parsed.args) ||
    parsed.args.some((entry) => typeof entry !== "string") ||
    typeof parsed.cwd !== "string" ||
    parsed.cwd.trim() === ""
  ) {
    throw new Error("Managed dev supervisor received an invalid descriptor.");
  }

  return {
    command: parsed.command,
    args: parsed.args,
    cwd: parsed.cwd,
  };
};

const descriptor = decodeCommand(process.argv[2]);
const child = crossSpawn(descriptor.command, descriptor.args, {
  cwd: descriptor.cwd,
  env: process.env,
  stdio: "inherit",
});

let terminal = false;
const exitOnce = (code: number): void => {
  if (terminal) {
    return;
  }
  terminal = true;
  process.exit(code);
};

child.once("error", (error) => {
  console.error(`[airjam-dev-supervisor] ${error.message}`);
  exitOnce(1);
});

child.once("exit", (code, signal) => {
  if (signal) {
    exitOnce(1);
    return;
  }
  exitOnce(code ?? 1);
});

const forwardSignal = (signal: NodeJS.Signals): void => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));
