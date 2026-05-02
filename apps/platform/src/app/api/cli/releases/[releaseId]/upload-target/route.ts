import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { requestReleaseUploadTargetForMachine } from "@/server/releases/machine-release";
import {
  platformMachineRequestReleaseUploadTargetInputSchema,
  platformMachineRequestReleaseUploadTargetResultSchema,
} from "@air-jam/sdk/platform-machine";
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
    const input = await readMachineApiJson({
      request,
      schema: platformMachineRequestReleaseUploadTargetInputSchema,
    });

    const result = await requestReleaseUploadTargetForMachine({
      releaseId: params.releaseId,
      userId: auth.user.id,
      originalFilename: input.originalFilename,
      sizeBytes: input.sizeBytes,
    });

    return NextResponse.json(
      platformMachineRequestReleaseUploadTargetResultSchema.parse(result),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
