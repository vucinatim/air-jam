import { z } from "zod";
import type { AirJamDevMode, PackageJson } from "./types.js";

const workspaceSchema = z
  .object({
    cli: z.string().min(1),
    modes: z
      .array(z.enum(["standalone-dev", "arcade-dev", "arcade-test"]))
      .min(1),
  })
  .strict();

export const readWorkspaceContract = (packageJson: PackageJson | null) => {
  const declaration = z
    .object({ workspace: workspaceSchema.optional() })
    .passthrough()
    .parse(packageJson?.airjam ?? {});
  return declaration.workspace ?? null;
};

export const assertSupportedDevMode = (
  packageJson: PackageJson | null,
  mode: AirJamDevMode,
) => {
  const workspace = readWorkspaceContract(packageJson);
  const supportedModes = workspace?.modes ?? ["standalone-dev"];
  if (!supportedModes.includes(mode)) {
    throw new Error(
      `Mode "${mode}" is not supported by this project. Supported modes: ${supportedModes.join(", ")}.`,
    );
  }
};
