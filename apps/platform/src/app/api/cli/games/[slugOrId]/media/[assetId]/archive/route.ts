import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { archiveOwnedGameMediaAssetForMachine } from "@/server/games/machine-game-media";
import { platformMachineMutateOwnedGameMediaAssetResultSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    slugOrId: string;
    assetId: string;
  }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const { slugOrId, assetId } = await context.params;
    const result = await archiveOwnedGameMediaAssetForMachine({
      slugOrId,
      userId: auth.user.id,
      assetId,
    });

    return NextResponse.json(
      platformMachineMutateOwnedGameMediaAssetResultSchema.parse(result),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
