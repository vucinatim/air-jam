import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { publishReleaseForMachine } from "@/server/releases/machine-release";
import { platformMachinePublishReleaseResultSchema } from "@air-jam/sdk/platform-machine";
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
    const release = await publishReleaseForMachine({
      releaseId: params.releaseId,
      userId: auth.user.id,
    });

    return NextResponse.json(
      platformMachinePublishReleaseResultSchema.parse({
        release,
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
