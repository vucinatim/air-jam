import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { listOwnedGamesForMachine } from "@/server/releases/machine-release";
import { platformMachineListOwnedGamesResultSchema } from "@air-jam/sdk/platform-machine";
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
