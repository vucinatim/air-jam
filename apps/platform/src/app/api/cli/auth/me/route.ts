import { toMachineApiErrorResponse } from "@/server/auth/machine-api";
import {
  requireMachineSessionFromRequest,
  toMachineMeResult,
} from "@/server/auth/machine-session";
import { platformMachineMeResultSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const GET = async (request: Request) => {
  try {
    const auth = await requireMachineSessionFromRequest({ request });
    return NextResponse.json(
      platformMachineMeResultSchema.parse(toMachineMeResult(auth)),
    );
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
