import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import {
  createOwnedGameForMachine,
  listOwnedGamesForMachine,
} from "@/server/games/machine-game";
import {
  platformMachineCreateOwnedGameInputSchema,
  platformMachineCreateOwnedGameResultSchema,
  platformMachineListOwnedGamesResultSchema,
} from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const GET = async (request: Request) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const games = await listOwnedGamesForMachine(auth.user.id);

    return NextResponse.json(
      platformMachineListOwnedGamesResultSchema.parse({
        games,
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};

export const POST = async (request: Request) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const input = await readMachineApiJson({
      request,
      schema: platformMachineCreateOwnedGameInputSchema,
    });
    const game = await createOwnedGameForMachine({
      userId: auth.user.id,
      input,
    });

    return NextResponse.json(
      platformMachineCreateOwnedGameResultSchema.parse({
        game,
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
