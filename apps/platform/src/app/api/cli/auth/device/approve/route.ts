import { auth } from "@/lib/auth";
import {
  readMachineApiJson,
  toMachineApiErrorResponse,
} from "@/server/auth/machine-api";
import { PlatformMachineAuthError } from "@/server/auth/machine-auth-errors";
import { approveMachineDeviceGrant } from "@/server/auth/machine-device-flow";
import { NextResponse } from "next/server";
import { z } from "zod";

const approveDeviceGrantInputSchema = z.object({
  userCode: z.string().trim().min(1),
});

export const POST = async (request: Request) => {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      throw new PlatformMachineAuthError({
        code: "unauthorized",
        message: "Sign in to approve Air Jam CLI access.",
        status: 401,
      });
    }

    const input = await readMachineApiJson({
      request,
      schema: approveDeviceGrantInputSchema,
    });

    const grant = await approveMachineDeviceGrant({
      userCode: input.userCode,
      userId: session.user.id,
    });

    return NextResponse.json({
      ok: true,
      userCode: grant.userCode,
      status: grant.status,
    });
  } catch (error) {
    return toMachineApiErrorResponse(error);
  }
};
