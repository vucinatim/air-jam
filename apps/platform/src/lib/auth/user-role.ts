import { z } from "zod";

export const userRoleValues = ["creator", "ops_admin"] as const;
export type UserRole = (typeof userRoleValues)[number];
export const userRoleSchema = z.enum(userRoleValues);

export const isOpsAdmin = (role: UserRole): boolean => role === "ops_admin";
