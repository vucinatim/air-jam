import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { startMachineDeviceGrant } from "@/server/auth/machine-device-flow";
import { platformMachineDeviceStartInputSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

export const POST = async (request: Request) => {
  try {
    const input = await readMachineApiJson({
      request,
      schema: platformMachineDeviceStartInputSchema,
    });

    const result = await startMachineDeviceGrant({
      clientName: input.clientName,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
