import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { finalizeReleaseUploadForMachine } from "@/server/releases/machine-release";
import { platformMachineFinalizeReleaseUploadResultSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const POST = async (
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
    const release = await finalizeReleaseUploadForMachine({
      releaseId: params.releaseId,
      userId: auth.user.id,
    });

    return NextResponse.json(
      platformMachineFinalizeReleaseUploadResultSchema.parse({
        release,
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
