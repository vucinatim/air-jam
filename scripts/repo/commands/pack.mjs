import { verifyFoundationLibraryPackages } from "../lib/foundation-library-package-proof.mjs";
import { verifyServerPackage } from "../lib/server-package-proof.mjs";
import { runRepoPackLocalCommand } from "./pack-local.mjs";

export const registerPackCommands = (program) => {
  const packCommand = program
    .command("pack")
    .description("Local package packing helpers");

  packCommand
    .command("verify-local")
    .description("Build and qualify the exact local foundation package set")
    .option("--json", "Emit structured package verification evidence", false)
    .action(async (options) => {
      const packed = runRepoPackLocalCommand({ quiet: options.json });
      const server = await verifyServerPackage(packed.setDir);
      const libraries = await verifyFoundationLibraryPackages(packed.setDir);
      const result = { ok: true, setId: packed.setId, server, libraries };
      console.log(
        options.json
          ? JSON.stringify(result)
          : `Local foundation packages verified: ${packed.setId}`,
      );
    });

  packCommand
    .command("verify-server <setDir>")
    .description(
      "Verify a packed server and SDK in a clean typed consumer with real room traffic",
    )
    .option("--json", "Emit structured package verification evidence", false)
    .action(async (setDir, options) => {
      const result = await verifyServerPackage(setDir);
      console.log(
        options.json
          ? JSON.stringify(result)
          : `Server package verified: ${result.setId}`,
      );
    });

  packCommand
    .command("verify-libraries <setDir>")
    .description(
      "Verify installed foundation library types and agent helper execution without workspace source",
    )
    .option("--json", "Emit structured package verification evidence", false)
    .action(async (setDir, options) => {
      const result = await verifyFoundationLibraryPackages(setDir);
      console.log(
        options.json
          ? JSON.stringify(result)
          : `Foundation libraries verified: ${result.setId}`,
      );
    });

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
