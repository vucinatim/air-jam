import { db } from "@/db";
import { appIds, games } from "@/db/schema";
import {
  gameConfigSourceUrlSchema,
  gameConfigTemplateIdSchema,
  parseGameConfig,
} from "@/lib/games/game-config-contract";
import { z } from "zod";
import { assertOperationalLaneAccepting } from "../operations/production-control-service";

export const ownedGameSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const creationSchema = z.object({
  name: z.string().trim().min(1),
  slug: ownedGameSlugSchema.optional(),
  description: z.string().trim().optional(),
  url: z.string().trim().url().optional(),
  sourceUrl: gameConfigSourceUrlSchema.optional(),
  templateId: gameConfigTemplateIdSchema.optional(),
});

/** A new hidden game and its usable App ID are one owned resource. */
export const createOwnedGame = async ({
  database = db,
  userId,
  input,
}: {
  database?: typeof db;
  userId: string;
  input: z.input<typeof creationSchema>;
}) => {
  const normalized = creationSchema.parse(input);
  await assertOperationalLaneAccepting({ database, lane: "game_creation" });

  return database.transaction(async (tx) => {
    const gameId = crypto.randomUUID();
    const [game] = await tx
      .insert(games)
      .values({
        id: gameId,
        userId,
        name: normalized.name,
        slug: normalized.slug ?? null,
        description: normalized.description || null,
        url: normalized.url ?? null,
        arcadeVisibility: "hidden",
        config: parseGameConfig({
          sourceUrl: normalized.sourceUrl,
          templateId: normalized.templateId,
        }),
      })
      .returning();

    await tx.insert(appIds).values({
      id: crypto.randomUUID(),
      gameId,
      creatorId: userId,
      key: `aj_app_${crypto.randomUUID().replace(/-/g, "")}`,
    });
    return game;
  });
};
