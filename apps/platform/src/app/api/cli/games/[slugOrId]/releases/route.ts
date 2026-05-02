import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { listOwnedReleasesForMachine } from "@/server/releases/machine-release";
import { platformMachineListReleasesResultSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const GET = async (
  request: Request,
  context: {
    params: Promise<{
      slugOrId: string;
    }>;
  },
) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const params = await context.params;
    const result = await listOwnedReleasesForMachine({
      slugOrId: params.slugOrId,
      userId: auth.user.id,
    });

    return NextResponse.json(
      platformMachineListReleasesResultSchema.parse(result),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
