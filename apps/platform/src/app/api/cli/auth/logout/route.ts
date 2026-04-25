import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import {
  requireMachineSessionFromRequest,
  revokeMachineSessionByToken,
} from "@/server/auth/machine-session";
import { platformMachineLogoutResultSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const POST = async (request: Request) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    await revokeMachineSessionByToken({ token: auth.token });
    return NextResponse.json(
      platformMachineLogoutResultSchema.parse({ ok: true }),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
