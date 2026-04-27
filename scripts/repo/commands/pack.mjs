import { runRepoPackLocalCommand } from "./pack-local.mjs";

export const registerPackCommands = (program) => {
  const packCommand = program
    .command("pack")
    .description("Local package packing helpers");

  packCommand
    .command("local")
    .description(
      "Pack the full local prerelease scaffold package set under .airjam/tarballs",
    )
    .action(() => {
      runRepoPackLocalCommand();
    });

  return packCommand;
};
