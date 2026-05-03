import { spawnSync } from "node:child_process";

import {
  resolvePublicPackages,
  resolveUnifiedPublicVersion,
} from "../../release/public-packages.mjs";

const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const assertChannel = (channel) => {
  if (channel !== "latest" && channel !== "next") {
    throw new Error(`Unsupported release channel "${channel}".`);
  }
};

const buildReleaseTag = ({ channel, version }) => {
  return channel === "next"
    ? `release/public-next-v${version}`
    : `release/public-v${version}`;
};

const runRepoReleaseTriggerCommand = ({ channel, packageSelection }) => {
  assertChannel(channel);
  resolvePublicPackages(packageSelection);

  runCommand("gh", [
    "workflow",
    "run",
    "publish-packages.yml",
    "-f",
    `package=${packageSelection}`,
    "-f",
    `channel=${channel}`,
  ]);
};

const runRepoReleaseTagCommand = ({ channel }) => {
  assertChannel(channel);

  const releaseVersion = resolveUnifiedPublicVersion();
  const tag = buildReleaseTag({ channel, version: releaseVersion });

  runCommand("git", ["tag", tag]);
  runCommand("git", ["push", "origin", tag]);
};

export const registerReleaseCommands = (program) => {
  const releaseCommand = program
    .command("release")
    .description("Public npm release helpers");

  releaseCommand
    .command("trigger")
    .description(
      "Trigger the Publish Packages GitHub Actions workflow through gh",
    )
    .option(
      "--package <packageSelection>",
      "Public package selection to publish",
      "all-public",
    )
    .option("--channel <channel>", "npm dist-tag to publish under", "latest")
    .action((options) => {
      runRepoReleaseTriggerCommand({
        channel: options.channel,
        packageSelection: options.package,
      });
    });

  releaseCommand
    .command("tag")
    .description(
      "Create and push the canonical public release tag for automated GitHub publishing",
    )
    .option("--channel <channel>", "npm dist-tag to publish under", "latest")
    .action((options) => {
      runRepoReleaseTagCommand({
        channel: options.channel,
      });
    });

  return releaseCommand;
};
