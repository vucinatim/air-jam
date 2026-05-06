import { createPreviewManifest } from "../lib/preview-manifest.mjs";
import { createPreviewPlan } from "../lib/preview-plan.mjs";
import {
  destroyPreviewDatabase,
  preparePreviewDatabase,
} from "../lib/preview-database.mjs";
import { bringPreviewUp, tearPreviewDown } from "../lib/preview-lifecycle.mjs";
import {
  deployPreviewRailwayServices,
  destroyPreviewRailwayEnvironment,
  preparePreviewRailwayEnvironment,
  resolveRailwayServicePublicDomain,
} from "../lib/preview-railway.mjs";
import {
  gatherPreviewReadiness,
  summarizePreviewReadiness,
} from "../lib/preview-readiness.mjs";
import {
  deployPreviewPlatform,
  destroyPreviewPlatform,
} from "../lib/preview-vercel.mjs";

const printJson = (value) => {
  console.log(JSON.stringify(value, null, 2));
};

export const registerPreviewCommands = (program) => {
  const previewCommand = program
    .command("preview")
    .description("Preview environment planning helpers");

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
    .action((options) => {
      const readiness = gatherPreviewReadiness();
      if (options.json) {
        printJson(readiness);
        return;
      }

      console.log(summarizePreviewReadiness(readiness));
    });

  previewCommand
    .command("railway-prepare")
    .description(
      "Duplicate production into a preview Railway environment and apply canonical preview overrides",
    )
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--apply", "Create the environment/services instead of dry-run")
    .option("--json", "Print raw JSON")
    .action((options) => {
      const result = preparePreviewRailwayEnvironment({
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
    .command("database-prepare")
    .description("Create the canonical preview schema in the preview Postgres database")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--apply", "Create the schema instead of dry-run")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const result = await preparePreviewDatabase({
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
    .command("database-destroy")
    .description("Drop the canonical preview schema from the preview Postgres database")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--apply", "Drop the schema instead of dry-run")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const result = await destroyPreviewDatabase({
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
    .command("railway-destroy")
    .description("Delete the preview Railway environment for a PR")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--apply", "Delete the environment instead of dry-run")
    .option("--json", "Print raw JSON")
    .action((options) => {
      const manifest = createPreviewManifest({ prNumber: options.pr });
      const result = destroyPreviewRailwayEnvironment({
        environmentName: manifest.railway.environmentName,
        apply: Boolean(options.apply),
      });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  previewCommand
    .command("vercel-deploy")
    .description("Deploy the platform preview to Vercel and alias it to the canonical preview host")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .requiredOption("--server-public-domain <domain>", "Resolved server public domain")
    .requiredOption("--worker-public-domain <domain>", "Resolved worker public domain")
    .option("--apply", "Deploy the preview instead of dry-run")
    .option("--json", "Print raw JSON")
    .action((options) => {
      const result = deployPreviewPlatform({
        prNumber: options.pr,
        branchName: options.branch,
        commitSha: options.sha,
        previewBaseDomain: options.previewBaseDomain,
        serverPublicDomain: options.serverPublicDomain,
        workerPublicDomain: options.workerPublicDomain,
        apply: Boolean(options.apply),
      });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  previewCommand
    .command("vercel-destroy")
    .description("Remove the preview host alias and tagged Vercel deployments for a PR")
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option("--apply", "Destroy the preview instead of dry-run")
    .option("--json", "Print raw JSON")
    .action((options) => {
      const result = destroyPreviewPlatform({
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
    .command("railway-deploy")
    .description(
      "Deploy the canonical preview Railway services into the duplicated environment",
    )
    .requiredOption("--pr <number>", "Pull request number")
    .option("--branch <name>", "Git branch name")
    .option("--sha <sha>", "Git commit SHA")
    .option(
      "--preview-base-domain <domain>",
      "Base domain used for preview hosts (for example: preview.airjam.io)",
    )
    .option(
      "--service <name>",
      "Deploy one service only (air-jam-server or air-jam-release-browser-worker)",
    )
    .option("--apply", "Run the deployment instead of dry-run")
    .option("--json", "Print raw JSON")
    .action((options) => {
      const result = deployPreviewRailwayServices({
        prNumber: options.pr,
        branchName: options.branch,
        commitSha: options.sha,
        previewBaseDomain: options.previewBaseDomain,
        selectedServices: options.service ?? "all",
        apply: Boolean(options.apply),
      });

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  previewCommand
    .command("railway-service-domain")
    .description("Resolve the public domain for a service in a Railway environment")
    .requiredOption("--environment <name>", "Railway environment name")
    .requiredOption("--service <name>", "Railway service name")
    .option("--json", "Print raw JSON")
    .action((options) => {
      const domain = resolveRailwayServicePublicDomain({
        environmentName: options.environment,
        serviceName: options.service,
      });
      const result = {
        environmentName: options.environment,
        serviceName: options.service,
        publicDomain: domain,
      };

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  return previewCommand;
};
