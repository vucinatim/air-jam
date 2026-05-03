import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { requireMachineSessionFromRequest } from "@/server/auth/machine-session";
import {
  inspectOwnedGameMediaForMachine,
  requestOwnedGameMediaUploadTargetForMachine,
} from "@/server/games/machine-game-media";
import {
  platformMachineGetOwnedGameMediaResultSchema,
  platformMachineRequestOwnedGameMediaUploadTargetInputSchema,
  platformMachineRequestOwnedGameMediaUploadTargetResultSchema,
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
    const result = await inspectOwnedGameMediaForMachine({
      slugOrId,
      userId: auth.user.id,
    });

    return NextResponse.json(
      platformMachineGetOwnedGameMediaResultSchema.parse(result),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};

export const POST = async (request: Request, context: RouteContext) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    const { slugOrId } = await context.params;
    const input = await readMachineApiJson({
      request,
      schema: platformMachineRequestOwnedGameMediaUploadTargetInputSchema,
    });
    const result = await requestOwnedGameMediaUploadTargetForMachine({
      slugOrId,
      userId: auth.user.id,
      kind: input.kind,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });

    return NextResponse.json(
      platformMachineRequestOwnedGameMediaUploadTargetResultSchema.parse(result),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
