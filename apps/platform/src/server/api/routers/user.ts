import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be 50 characters or fewer"),
});

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, ctx.user.id),
    });

    if (!user) {
      throw new Error("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(users)
        .set({
          name: input.displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        });

      if (!updated) {
        throw new Error("Failed to update profile");
      }

      return updated;
    }),
});
