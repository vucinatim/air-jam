import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { pollMachineDeviceGrant } from "@/server/auth/machine-device-flow";
import { platformMachineDevicePollInputSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";

const readRequestIpAddress = (request: Request): string | null => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
};

export const POST = async (request: Request) => {
  try {
    const input = await readMachineApiJson({
      request,
      schema: platformMachineDevicePollInputSchema,
    });

    const result = await pollMachineDeviceGrant({
      deviceCode: input.deviceCode,
      ipAddress: readRequestIpAddress(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
