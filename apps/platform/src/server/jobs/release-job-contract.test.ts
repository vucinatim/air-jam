import { describe, expect, it } from "vitest";
import {
  createReleaseGenerationJobPayload,
  createReleaseImageModerationJobPayload,
  parseReleaseJobPayload,
  parseReleaseJobResult,
  releaseJobExecutionContractVersion,
  ReleaseJobExecutionError,
  releaseJobProgressSchema,
  serializeReleaseJobExecutionError,
} from "./release-job-contract";

describe("release job execution contracts", () => {
  it("uses strict versioned generation payloads", () => {
    expect(
      createReleaseGenerationJobPayload({ generationId: "generation_1" }),
    ).toEqual({ contractVersion: 1, generationId: "generation_1" });
    expect(() =>
      parseReleaseJobPayload("release_artifact_processing", {
        contractVersion: 1,
        generationId: "generation_1",
        legacyReleaseId: "release_1",
      }),
    ).toThrow();
  });

  it("binds moderation evidence to a capture identity and safe storage key", () => {
    const payload = createReleaseImageModerationJobPayload({
      generationId: "generation_1",
      screenshot: {
        captureId: "attempt_1",
        objectKey:
          "games/game_1/releases/release_1/generations/generation_1/screenshots/attempt_1/capture.png",
        contentType: "image/png",
        sizeBytes: 42,
        width: 1280,
        height: 720,
      },
    });
    expect(payload.screenshot.captureId).toBe("attempt_1");
    expect(() =>
      createReleaseImageModerationJobPayload({
        generationId: "generation_1",
        screenshot: { ...payload.screenshot, objectKey: "../private.png" },
      }),
    ).toThrow();
  });

  it("rejects impossible progress and result shapes", () => {
    expect(() =>
      releaseJobProgressSchema.parse({
        contractVersion: releaseJobExecutionContractVersion,
        stage: "writing_outputs",
        completedUnits: 2,
        totalUnits: 1,
      }),
    ).toThrow();
    expect(() =>
      parseReleaseJobResult("release_browser_validation", {
        contractVersion: releaseJobExecutionContractVersion,
        generationId: "generation_1",
        screenshot: {
          objectKey: "safe/capture.png",
          contentType: "image/png",
          sizeBytes: 1,
          width: 1,
          height: 1,
        },
        nextJobId: "job_2",
      }),
    ).toThrow();
  });

  it("preserves explicit retry policy while failing unknown errors retryably", () => {
    expect(
      serializeReleaseJobExecutionError({
        error: new ReleaseJobExecutionError({
          code: "invalid_release_archive",
          message: "Invalid manifest.",
          retryable: false,
          stage: "validating_archive",
        }),
        stage: "validating_archive",
      }),
    ).toMatchObject({
      code: "invalid_release_archive",
      retryable: false,
      stage: "validating_archive",
    });
    expect(
      serializeReleaseJobExecutionError({
        error: new Error("provider timeout"),
        stage: "moderating_image",
      }),
    ).toMatchObject({
      code: "unexpected_executor_error",
      retryable: true,
      stage: "moderating_image",
    });
  });
});
