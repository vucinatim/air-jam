import { platformMachineApiErrorSchema } from "@air-jam/sdk/platform-machine";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import {
  PlatformMachineAuthError,
  isPlatformMachineAuthError,
} from "./machine-auth-errors";

export const readMachineApiJson = async <T>({
  request,
  schema,
}: {
  request: Request;
  schema: ZodType<T>;
}): Promise<T> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PlatformMachineAuthError({
      code: "invalid_request",
      message: "Request body must be valid JSON.",
      status: 400,
    });
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PlatformMachineAuthError({
        code: "validation_failed",
        message: error.issues[0]?.message ?? "Invalid request body.",
        status: 400,
      });
    }

    throw error;
  }
};

export const toMachineApiErrorResponse = (error: unknown) => {
  if (isPlatformMachineAuthError(error)) {
    return NextResponse.json(
      platformMachineApiErrorSchema.parse({
        error: error.code,
        message: error.message,
      }),
      { status: error.status },
    );
  }

  return NextResponse.json(
    platformMachineApiErrorSchema.parse({
      error: "invalid_request",
      message: "Unexpected machine API failure.",
    }),
    { status: 500 },
  );
};
