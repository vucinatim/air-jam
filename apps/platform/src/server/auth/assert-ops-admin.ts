import { TRPCError } from "@trpc/server";
import { isOpsAdmin, type UserRole } from "@/lib/auth/user-role";

export const assertOpsAdmin = (user: { role: UserRole }) => {
  if (!isOpsAdmin(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
};
