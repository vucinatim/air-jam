import {
  checkPlatformGameSlugAvailability,
  inspectPlatformGameAppId,
  regeneratePlatformGameAppId,
  updatePlatformGameAppIdOrigins,
} from "@air-jam/devtools/platform-game-app-id";
import { Command, Option } from "commander";

type GameOptions = { game: string; platformUrl?: string; json: boolean };

const printAppId = (
  result: Awaited<ReturnType<typeof inspectPlatformGameAppId>>,
  json: boolean,
) => {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`App ID: ${result.key}`);
    console.log(
      `Allowed origins: ${result.allowedOrigins?.join(", ") ?? "unrestricted"}`,
    );
    console.log(`Active: ${result.isActive}`);
    console.log(`Created: ${result.createdAt}`);
    console.log(`Last used: ${result.lastUsedAt ?? "never"}`);
  }
};

export const registerGameAppIdCommands = (gameCommand: Command) => {
  const appId = gameCommand
    .command("app-id")
    .description("Inspect and manage an owned game's App ID");

  appId
    .command("inspect")
    .description("Read the App ID and allowed origins")
    .requiredOption("--game <slug-or-id>", "Owned game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(async (options: GameOptions) => {
      printAppId(
        await inspectPlatformGameAppId({
          slugOrId: options.game,
          platformUrl: options.platformUrl,
        }),
        options.json,
      );
    });

  appId
    .command("origins")
    .description("Replace allowed origins, or clear restrictions")
    .requiredOption("--game <slug-or-id>", "Owned game slug or ID")
    .addOption(
      new Option(
        "--origin <url>",
        "Allowed origin; repeat for multiple origins",
      )
        .argParser((value: string, previous: string[] = []) => [
          ...previous,
          value,
        ])
        .conflicts("clear"),
    )
    .addOption(new Option("--clear", "Allow any origin").conflicts("origin"))
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(
      async (options: GameOptions & { origin?: string[]; clear?: boolean }) => {
        if (!options.clear && !options.origin?.length)
          throw new Error("Provide --origin <url> or --clear.");
        printAppId(
          await updatePlatformGameAppIdOrigins({
            slugOrId: options.game,
            platformUrl: options.platformUrl,
            allowedOrigins: options.origin ?? [],
          }),
          options.json,
        );
      },
    );

  appId
    .command("regenerate")
    .description("Rotate the App ID; breaks deployed games")
    .requiredOption("--game <slug-or-id>", "Owned game slug or ID")
    .option("--yes", "Confirm breaking deployed games", false)
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(async (options: GameOptions & { yes: boolean }) => {
      printAppId(
        await regeneratePlatformGameAppId({
          slugOrId: options.game,
          platformUrl: options.platformUrl,
          yes: options.yes,
        }),
        options.json,
      );
    });

  gameCommand
    .command("slug-available")
    .description(
      "Check a slug, optionally excluding an owned game when renaming",
    )
    .requiredOption("--slug <slug>", "Slug to check")
    .option("--game <slug-or-id>", "Owned game to exclude")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(
      async (options: {
        slug: string;
        game?: string;
        platformUrl?: string;
        json: boolean;
      }) => {
        const result = await checkPlatformGameSlugAvailability(options);
        if (options.json)
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        else console.log(result.available ? "Available" : "Unavailable");
      },
    );
};
