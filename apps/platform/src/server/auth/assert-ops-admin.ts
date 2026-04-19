import { isOpsAdmin, type UserRole } from "@/lib/auth/user-role";
import { TRPCError } from "@trpc/server";

export const assertOpsAdmin = (user: { role: UserRole }) => {
  if (!isOpsAdmin(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
};
