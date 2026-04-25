import { runRepoPackLocalCommand } from "./pack-local.mjs";

export const registerPackCommands = (program) => {
  const packCommand = program
    .command("pack")
    .description("Local package packing helpers");

  packCommand
    .command("local")
    .description(
      "Pack local SDK/server/create-airjam tarballs under .airjam/tarballs",
    )
    .action(() => {
      runRepoPackLocalCommand();
    });

  return packCommand;
};
