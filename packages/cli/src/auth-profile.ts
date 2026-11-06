import { updatePlatformMachineProfile } from "@air-jam/devtools/platform-auth";
import type { Command } from "commander";

export const registerAuthProfileCommand = (authCommand: Command) => {
  authCommand
    .command("profile")
    .description("Set the creator display name shown on games and in rooms")
    .requiredOption(
      "--display-name <name>",
      "Creator display name (1–50 characters)",
    )
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(
      async (options: {
        displayName: string;
        platformUrl?: string;
        json: boolean;
      }) => {
        const profile = await updatePlatformMachineProfile(options);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
        } else {
          console.log(`Display name: ${profile.name}`);
        }
      },
    );
};
