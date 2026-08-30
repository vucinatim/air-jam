import { eq } from "drizzle-orm";
import { db } from "../db";
import { gameReleases, games, users } from "../db/schema";
import { auth } from "./auth";
import { PREVIEW_TESTER_CREDENTIALS } from "./preview-tester-credentials";

const PREVIEW_GAME_ID = "preview-game-001";
const PREVIEW_RELEASE_ID = "preview-release-001";

/**
 * Seed a minimal data set so a Railway PR preview has something to
 * show / interact with on first boot. Strictly idempotent: every
 * write either checks for existence first or uses ON CONFLICT DO
 * NOTHING.
 *
 * What lands:
 *   - One user (PREVIEW_TESTER_CREDENTIALS) created via better-auth
 *     so the password hash matches whatever auth scheme the app uses.
 *   - One hidden game (`preview-pong`) for authenticated dashboard smoke tests.
 *   - One archived release with no fabricated playable generation.
 *
 * Public arcade proof must use a real uploaded release. Preview seed data must
 * never claim that a placeholder object is a validated or playable build.
 */
export async function seedPreviewData(): Promise<void> {
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, PREVIEW_TESTER_CREDENTIALS.email))
    .limit(1);

  let userId: string;
  if (existingUser.length === 0) {
    const result = await auth.api.signUpEmail({
      body: {
        email: PREVIEW_TESTER_CREDENTIALS.email,
        password: PREVIEW_TESTER_CREDENTIALS.password,
        name: PREVIEW_TESTER_CREDENTIALS.name,
      },
    });
    userId = result.user.id;
  } else {
    userId = existingUser[0].id;
  }

  await db
    .insert(games)
    .values({
      id: PREVIEW_GAME_ID,
      userId,
      name: "Preview Pong",
      slug: "preview-pong",
      description:
        "Seeded by the platform on Railway PR preview boot for authenticated dashboard smoke tests.",
      arcadeVisibility: "hidden",
    })
    .onConflictDoNothing();

  await db
    .insert(gameReleases)
    .values({
      id: PREVIEW_RELEASE_ID,
      gameId: PREVIEW_GAME_ID,
      sourceKind: "upload",
      status: "archived",
      versionLabel: "preview-seed",
    })
    .onConflictDoNothing();

  await db
    .update(games)
    .set({
      arcadeVisibility: "hidden",
      updatedAt: new Date(),
    })
    .where(eq(games.id, PREVIEW_GAME_ID));

  await db
    .update(gameReleases)
    .set({
      status: "archived",
      candidateGenerationId: null,
      promotedGenerationId: null,
      publishedAt: null,
      archivedAt: new Date(),
    })
    .where(eq(gameReleases.id, PREVIEW_RELEASE_ID));
}
