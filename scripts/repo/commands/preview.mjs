import { createPreviewManifest } from "../lib/preview-manifest.mjs";
import { createPreviewPlan } from "../lib/preview-plan.mjs";
import { bringPreviewUp, tearPreviewDown } from "../lib/preview-lifecycle.mjs";
import {
  gatherPreviewReadiness,
  summarizePreviewReadiness,
} from "../lib/preview-readiness.mjs";
import { sweepPreviews } from "../lib/preview-sweep.mjs";

const printJson = (value) => {
  console.log(JSON.stringify(value, null, 2));
};

export const registerPreviewCommands = (program) => {
  const previewCommand = program
    .command("preview")
    .description("Full-stack preview environment helpers");

  previewCommand
    .command("manifest")
    .description("Print the canonical preview manifest for a pull request")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .action((options) => {
      printJson(
        createPreviewManifest({
          prNumber: options.pr,
          branchName: options.branch,
          commitSha: options.sha,
          previewBaseDomain: options.previewBaseDomain,
        }),
      );
    });

  previewCommand
    .command("plan")
    .description(
      "Print the redacted preview provisioning plan for a pull request",
    )
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--server-public-domain <domain>", "Resolved server public domain")
    .option(
      "--worker-public-domain <domain>",
      "Resolved worker public domain",
    )
    .action((options) => {
      printJson(
        createPreviewPlan({
          prNumber: options.pr,
          branchName: options.branch,
          commitSha: options.sha,
          previewBaseDomain: options.previewBaseDomain,
          serverPublicDomain: options.serverPublicDomain,
          workerPublicDomain: options.workerPublicDomain,
        }),
      );
    });

  previewCommand
    .command("up")
    .description(
      "Prepare the preview database and Railway environment, deploy server/worker/platform, and verify the full stack",
    )
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--apply", "Run the full preview lifecycle instead of dry-run")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const result = await bringPreviewUp({
        prNumber: options.pr,
        branchName: options.branch,
        commitSha: options.sha,
        previewBaseDomain: options.previewBaseDomain,
        apply: Boolean(options.apply),
      });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  previewCommand
    .command("down")
    .description(
      "Remove the preview platform alias/deployments, preview database schema, and preview Railway environment",
    )
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--apply", "Run the full preview teardown instead of dry-run")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const result = await tearPreviewDown({
        prNumber: options.pr,
        branchName: options.branch,
        commitSha: options.sha,
        previewBaseDomain: options.previewBaseDomain,
        apply: Boolean(options.apply),
      });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  previewCommand
    .command("doctor")
    .description(
      "Inspect current repo/provider readiness for the on-demand full-stack preview lane",
    )
    .option("--json", "Print raw JSON instead of a summary")
    .action(async (options) => {
      const readiness = await gatherPreviewReadiness();
      if (options.json) {
        printJson(readiness);
        return;
      }

      console.log(summarizePreviewReadiness(readiness));
    });

  previewCommand
    .command("sweep")
    .description("Destroy orphaned preview resources for PRs that are no longer open")
    .option(
      "--open-prs <numbers>",
      "Comma-separated or JSON array list of still-open PR numbers",
    )
    .option("--apply", "Destroy orphaned previews instead of dry-run")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const result = await sweepPreviews({
        openPrNumbers: options.openPrs,
        apply: Boolean(options.apply),
      });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  return previewCommand;
};
