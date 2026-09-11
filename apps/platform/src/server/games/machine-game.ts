import { db } from "@/db";
import { games } from "@/db/schema";
import { arcadeVisibilitySchema } from "@/lib/games/arcade-visibility";
import {
  gameConfigSourceUrlSchema,
  gameConfigTemplateIdSchema,
  parseGameConfig,
  parseGameConfigLenient,
} from "@/lib/games/game-config-contract";
import type { PlatformMachineOwnedGameSummary } from "@air-jam/sdk/platform-machine";
import { and, desc, eq } from "drizzle-orm";
import { PlatformApplicationError } from "../application-error";
import {
  PlatformMachineAuthError,
  rethrowOperationalAdmissionForMachine,
} from "../auth/machine-auth-errors";
import { createOwnedGame, ownedGameSlugSchema } from "./game-creation-service";
import { assertGameListingAllowed } from "./game-listing-admission-service";

const toMachineNotFoundError = (message: string) =>
  new PlatformMachineAuthError({
    code: "not_found",
    message,
    status: 404,
  });

const toMachineConflictError = (message: string) =>
  new PlatformMachineAuthError({
    code: "conflict",
    message,
    status: 409,
  });

const toMachineValidationError = (message: string) =>
  new PlatformMachineAuthError({
    code: "validation_failed",
    message,
    status: 400,
  });

export const serializeOwnedGameForMachine = (
  game: typeof games.$inferSelect,
): PlatformMachineOwnedGameSummary => {
  const config = parseGameConfigLenient(game.config);

  return {
    id: game.id,
    slug: game.slug ?? null,
    name: game.name,
    description: game.description ?? null,
    url: game.url ?? null,
    arcadeVisibility: arcadeVisibilitySchema.parse(game.arcadeVisibility),
    sourceUrl: config.sourceUrl ?? null,
    templateId: config.templateId ?? null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
};

export const listOwnedGamesForMachine = async (userId: string) => {
  const ownedGames = await db
    .select()
    .from(games)
    .where(eq(games.userId, userId))
    .orderBy(desc(games.updatedAt));

  return ownedGames.map(serializeOwnedGameForMachine);
};

export const assertOwnedGameBySlugOrIdForMachine = async ({
  slugOrId,
  userId,
}: {
  slugOrId: string;
  userId: string;
}) => {
  const normalized = slugOrId.trim();

  const gameBySlug = await db.query.games.findFirst({
    where: and(eq(games.slug, normalized), eq(games.userId, userId)),
  });
  if (gameBySlug) {
    return gameBySlug;
  }

  const gameById = await db.query.games.findFirst({
    where: and(eq(games.id, normalized), eq(games.userId, userId)),
  });
  if (gameById) {
    return gameById;
  }

  throw toMachineNotFoundError(`No owned game matched "${normalized}".`);
};

export const createOwnedGameForMachine = async ({
  userId,
  input,
}: {
  userId: string;
  input: {
    name: string;
    slug?: string;
    description?: string;
    url?: string;
    arcadeVisibility?: "hidden" | "listed";
    sourceUrl?: string;
    templateId?: string;
  };
}) => {
  try {
    await assertGameListingAllowed({
      game: null,
      arcadeVisibility: input.arcadeVisibility,
    });
    const game = await createOwnedGame({ userId, input });
    return serializeOwnedGameForMachine(game);
  } catch (error) {
    rethrowOperationalAdmissionForMachine(error);
    if (
      error instanceof PlatformApplicationError &&
      error.code === "validation_failed"
    ) {
      throw toMachineValidationError(error.message);
    }
    if (error instanceof Error && error.message.includes("23505")) {
      const normalizedSlug = input.slug?.trim();
      throw toMachineConflictError(
        normalizedSlug
          ? `Slug "${normalizedSlug}" is already taken.`
          : "A unique hosted game field is already taken.",
      );
    }
    throw error;
  }
};

export const updateOwnedGameForMachine = async ({
  slugOrId,
  userId,
  input,
}: {
  slugOrId: string;
  userId: string;
  input: {
    name?: string;
    slug?: string;
    description?: string | null;
    url?: string | null;
    arcadeVisibility?: "hidden" | "listed";
    sourceUrl?: string | null;
    templateId?: string | null;
  };
}) => {
  const existingGame = await assertOwnedGameBySlugOrIdForMachine({
    slugOrId,
    userId,
  });

  try {
    await assertGameListingAllowed({
      game: existingGame,
      arcadeVisibility: input.arcadeVisibility,
    });
  } catch (error) {
    rethrowOperationalAdmissionForMachine(error);
    if (
      error instanceof PlatformApplicationError &&
      error.code === "validation_failed"
    ) {
      throw toMachineValidationError(error.message);
    }
    throw error;
  }

  const configPatch = { ...parseGameConfigLenient(existingGame.config) };

  if (input.sourceUrl !== undefined) {
    if (input.sourceUrl) {
      configPatch.sourceUrl = gameConfigSourceUrlSchema.parse(input.sourceUrl);
    } else {
      delete configPatch.sourceUrl;
    }
  }

  if (input.templateId !== undefined) {
    if (input.templateId) {
      configPatch.templateId = gameConfigTemplateIdSchema.parse(
        input.templateId,
      );
    } else {
      delete configPatch.templateId;
    }
  }

  try {
    const [updatedGame] = await db
      .update(games)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.slug !== undefined
          ? { slug: ownedGameSlugSchema.parse(input.slug) }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.url !== undefined ? { url: input.url?.trim() || null } : {}),
        ...(input.arcadeVisibility !== undefined
          ? { arcadeVisibility: input.arcadeVisibility }
          : {}),
        config: parseGameConfig(configPatch),
        updatedAt: new Date(),
      })
      .where(eq(games.id, existingGame.id))
      .returning();

    return serializeOwnedGameForMachine(updatedGame);
  } catch (error) {
    if (error instanceof Error && error.message.includes("23505")) {
      throw toMachineConflictError("Slug already taken. Please choose another.");
    }
    throw error;
  }
};
