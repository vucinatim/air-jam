import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const updateIdentity = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: updateIdentity,
  }));
  return {
    insert: vi.fn(() => ({ values })),
    values,
    updateIdentity,
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: "preview-user" }] }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({ where: async () => undefined }),
    })),
  };
});

vi.mock("../db", () => ({ db: mocks }));
vi.mock("./auth", () => ({ auth: { api: { signUpEmail: vi.fn() } } }));

import { appIds } from "../db/schema";
import { seedPreviewData } from "./seed-preview";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "staging-managed-capture");
  vi.stubEnv("AIRJAM_OPERATIONAL_ENVIRONMENT", "preview");
  vi.stubEnv("AIR_JAM_SYSTEM_APP_ID", "isolated-preview-app");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.example.test");
  vi.stubEnv("NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST", "https://preview.example.test");
  vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "preview.example.test");
});

afterEach(() => vi.unstubAllEnvs());

describe("preview seed identity", () => {
  it("registers one active Arcade identity on the hidden preview game", async () => {
    await seedPreviewData();
    expect(mocks.insert).toHaveBeenCalledWith(appIds);
    expect(mocks.values).toHaveBeenCalledWith({
      id: "preview-system-app-001",
      gameId: "preview-game-001",
      creatorId: "preview-user",
      key: "isolated-preview-app",
      allowedOrigins: ["https://preview.example.test"],
      isActive: true,
    });
    expect(mocks.updateIdentity).toHaveBeenCalledWith({
      target: appIds.id,
      set: {
        key: "isolated-preview-app",
        allowedOrigins: ["https://preview.example.test"],
        isActive: true,
      },
    });
  });

  it("rotates the same identity instead of accumulating old preview keys", async () => {
    await seedPreviewData();
    vi.stubEnv("AIR_JAM_SYSTEM_APP_ID", "rotated-preview-app");
    await seedPreviewData();
    expect(mocks.updateIdentity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: appIds.id,
        set: expect.objectContaining({ key: "rotated-preview-app" }),
      }),
    );
  });

  it("refuses production seeding before database IO", async () => {
    vi.stubEnv("AIRJAM_OPERATIONAL_ENVIRONMENT", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
    await expect(seedPreviewData()).rejects.toThrow("preview environment");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
