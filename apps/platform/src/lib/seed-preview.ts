import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  gameReleaseArtifacts,
  gameReleases,
  games,
  users,
} from "../db/schema";
import { auth } from "./auth";
import { PREVIEW_TESTER_CREDENTIALS } from "./preview-tester-credentials";

const PREVIEW_GAME_ID = "preview-game-001";
const PREVIEW_RELEASE_ID = "preview-release-001";
const PREVIEW_ARTIFACT_ID = "preview-artifact-001";

/**
 * Seed a minimal data set so a Railway PR preview has something to
 * show / interact with on first boot. Strictly idempotent: every
 * write either checks for existence first or uses ON CONFLICT DO
 * NOTHING.
 *
 * What lands:
 *   - One user (PREVIEW_TESTER_CREDENTIALS) created via better-auth
 *     so the password hash matches whatever auth scheme the app uses.
 *   - One game (`preview-pong`) with arcadeVisibility = "listed".
 *   - One game release with status = "live" + a placeholder artifact
 *     row. This is enough to make the game appear in the arcade
 *     listing; the placeholder asset paths mean the game won't
 *     actually launch — that's deliberate (no real artifact storage
 *     on previews).
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
        "Seeded by the platform on Railway PR preview boot. Not a real game — the artifact references a placeholder, so the listing renders but launching it will 404.",
      arcadeVisibility: "listed",
    })
    .onConflictDoNothing();

  await db
    .insert(gameReleases)
    .values({
      id: PREVIEW_RELEASE_ID,
      gameId: PREVIEW_GAME_ID,
      sourceKind: "upload",
      status: "live",
      versionLabel: "preview-seed",
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(gameReleaseArtifacts)
    .values({
      id: PREVIEW_ARTIFACT_ID,
      releaseId: PREVIEW_RELEASE_ID,
      originalFilename: "preview-pong.zip",
      contentType: "application/zip",
      sizeBytes: 0,
      zipObjectKey: "preview-seed-placeholder.zip",
      siteRootKey: "preview-seed-placeholder",
      entryPath: "index.html",
    })
    .onConflictDoNothing();
}
