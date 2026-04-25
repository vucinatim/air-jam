import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import {
  assertOwnedReleaseForMachine,
  serializeReleaseForMachine,
} from "@/server/releases/machine-release";
import { platformMachineGetReleaseResultSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const GET = async (
  request: Request,
  context: {
    params: Promise<{
      releaseId: string;
    }>;
  },
) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const params = await context.params;
    const release = await assertOwnedReleaseForMachine({
      releaseId: params.releaseId,
      userId: auth.user.id,
    });

    return NextResponse.json(
      platformMachineGetReleaseResultSchema.parse({
        release: serializeReleaseForMachine(release),
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
