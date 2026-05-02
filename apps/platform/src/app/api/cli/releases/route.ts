import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import { createDraftReleaseForMachine } from "@/server/releases/machine-release";
import {
  platformMachineCreateReleaseDraftInputSchema,
  platformMachineCreateReleaseDraftResultSchema,
} from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const POST = async (request: Request) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const input = await readMachineApiJson({
      request,
      schema: platformMachineCreateReleaseDraftInputSchema,
    });

    const release = await createDraftReleaseForMachine({
      slugOrId: input.slugOrId,
      userId: auth.user.id,
      versionLabel: input.versionLabel,
    });

    return NextResponse.json(
      platformMachineCreateReleaseDraftResultSchema.parse({
        release,
      }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
