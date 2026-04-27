import { runRepoScaffoldLocalCommand } from "./scaffold-local.mjs";

export const registerScaffoldCommands = (program) => {
  const scaffoldCommand = program
    .command("scaffold")
    .description("Local scaffold verification helpers");

  scaffoldCommand
    .command("local <projectName>")
    .description(
      "Scaffold a local game against the full workspace, tarball, or registry package graph",
    )
    .option("--source <source>", "Dependency source to use", "tarball")
    .option("--template <template>", "Template game to scaffold", "pong")
    .action((projectName, options) => {
      runRepoScaffoldLocalCommand({
        projectName,
        source: options.source,
        template: options.template,
      });
    });

  return scaffoldCommand;
};
