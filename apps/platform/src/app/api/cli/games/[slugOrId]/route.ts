import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import {
  assertOwnedGameBySlugOrIdForMachine,
  serializeOwnedGameForMachine,
  updateOwnedGameForMachine,
} from "@/server/games/machine-game";
import {
  platformMachineGetOwnedGameResultSchema,
  platformMachineUpdateOwnedGameInputSchema,
  platformMachineUpdateOwnedGameResultSchema,
} from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    slugOrId: string;
  }>;
};

export const GET = async (request: Request, context: RouteContext) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const { slugOrId } = await context.params;
    const game = await assertOwnedGameBySlugOrIdForMachine({
      slugOrId,
      userId: auth.user.id,
    });

    return NextResponse.json(
      platformMachineGetOwnedGameResultSchema.parse({
        game: serializeOwnedGameForMachine(game),
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};

export const PATCH = async (request: Request, context: RouteContext) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const { slugOrId } = await context.params;
    const input = await readMachineApiJson({
      request,
      schema: platformMachineUpdateOwnedGameInputSchema,
    });
    const game = await updateOwnedGameForMachine({
      slugOrId,
      userId: auth.user.id,
      input,
    });

    return NextResponse.json(
      platformMachineUpdateOwnedGameResultSchema.parse({
        game,
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
