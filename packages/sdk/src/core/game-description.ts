import { z } from "zod";
import {
  agentContractDescriptionSchema,
  createAirJamAgentEvaluator,
} from "../agent/agent-evaluator";
import { airJamGameMetadataSchema } from "../metadata/manifest";
import type { AirJamGame } from "./game";
import { airJamInputDescriptionSchema } from "./input";
import { airJamSettingSchema } from "./settings";

export const airJamGameDescriptionSchema = z
  .object({
    version: z.literal(1),
    metadata: airJamGameMetadataSchema,
    controllerPath: z.string(),
    simulation: z.boolean(),
    input: airJamInputDescriptionSchema.nullable(),
    agent: agentContractDescriptionSchema.nullable(),
    testing: z.boolean(),
    settings: z.record(z.string(), airJamSettingSchema),
  })
  .strict();
export type AirJamGameDescription = z.infer<typeof airJamGameDescriptionSchema>;

export function describeAirJamGame(game: AirJamGame): AirJamGameDescription {
  return airJamGameDescriptionSchema.parse({
    version: 1,
    metadata: game.metadata,
    controllerPath: game.controllerPath,
    simulation: Boolean(game.simulation),
    input: game.input ?? null,
    agent: game.agent
      ? createAirJamAgentEvaluator(game.agent).describe()
      : null,
    testing: Boolean(game.testing),
    settings: game.settings ?? {},
  });
}
