import { isOpsAdmin, type UserRole } from "@/lib/auth/user-role";
import { PlatformApplicationError } from "@/server/application-error";

export type AuthenticatedPlatformActor = {
  userId: string;
};

export type OperationsPlatformActor = AuthenticatedPlatformActor & {
  role: UserRole;
};

export const assertOperationsActor = (actor: OperationsPlatformActor): void => {
  if (!isOpsAdmin(actor.role)) {
    throw new PlatformApplicationError({
      code: "forbidden",
      message: "Operations access is required.",
    });
  }
};
