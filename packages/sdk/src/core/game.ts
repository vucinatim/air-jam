import { z } from "zod";
import type { AirJamAgentContract } from "../agent/agent-contract";
import {
  airJamGameMetadataSchema,
  type AirJamGameMetadata,
} from "../metadata/manifest";
import { HostRuntime, type HostRuntimeFactory } from "./host-runtime";
import type { AirJamInput } from "./input";
import type { AirJamInputBindings } from "./input-bindings";
import type { AttachableStore } from "./replicated-store";
import type { AirJamSimulationDeclaration } from "./simulation";

export interface AirJamGameDeclaration {
  metadata: AirJamGameMetadata;
  controllerPath?: string;
  stores?: readonly AttachableStore[];
  simulation?: AirJamSimulationDeclaration;
  input?: AirJamInput;
  inputBindings?: AirJamInputBindings;
  agent?: AirJamAgentContract;
  testing?: string;
}

export interface AirJamGame extends Readonly<AirJamGameDeclaration> {
  readonly controllerPath: string;
  readonly stores: readonly AttachableStore[];
  readonly createHostRuntime: HostRuntimeFactory;
}

const gameBrand = Symbol.for("airjam.game");
const controllerPathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !/[?#\\\s]/.test(value) &&
      !value.startsWith("//") &&
      !value.includes(":") &&
      !value.split("/").includes(".."),
    "Use a controller route path, such as /controller.",
  );
const testingPathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !value.includes(":") &&
      value
        .split("/")
        .reduce(
          (depth, part) =>
            depth < 0
              ? depth
              : depth +
                (part === ".." ? -1 : part === "." || part === "" ? 0 : 1),
          1,
        ) >= 0,
    "Declare testing as a relative module path inside the game project.",
  );

export function isAirJamGame(value: unknown): value is AirJamGame {
  return (
    typeof value === "object" &&
    value !== null &&
    gameBrand in value &&
    value[gameBrand] === true
  );
}

export function defineAirJamGame(
  declaration: AirJamGameDeclaration,
): AirJamGame {
  const metadata = Object.freeze(
    airJamGameMetadataSchema.parse(declaration.metadata),
  );
  if (declaration.inputBindings && !declaration.input)
    throw new Error(
      "inputBindings need the input they bind; declare input too.",
    );
  const requestedPath = controllerPathSchema.parse(
    declaration.controllerPath ?? "/controller",
  );
  if (declaration.testing !== undefined)
    testingPathSchema.parse(declaration.testing);
  const stores = Object.freeze([...(declaration.stores ?? [])]);
  const { agent, simulation, input } = declaration;
  return Object.freeze({
    ...declaration,
    [gameBrand]: true,
    metadata,
    controllerPath: requestedPath.startsWith("/")
      ? requestedPath
      : `/${requestedPath}`,
    stores,
    createHostRuntime: ((dependencies, options) =>
      new HostRuntime(
        {
          ...dependencies,
          config: { ...dependencies.config, maxPlayers: metadata.maxPlayers },
          stores,
          simulation,
          input,
          agent: agent && { contract: agent, gameId: metadata.slug },
        },
        options,
      )) satisfies HostRuntimeFactory,
  });
}
