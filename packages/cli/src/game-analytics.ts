import {
  getPlatformGameAnalyticsOverview,
  getPlatformGameAnalyticsSessions,
} from "@air-jam/devtools/platform-game-analytics";
import { Command, Option } from "commander";

export const registerGameAnalyticsCommand = (gameCommand: Command) => {
  gameCommand
    .command("analytics <game>")
    .description("Read creator gameplay analytics for an owned game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .addOption(
      new Option("--days <days>", "Overview window, 1–90 days (default: 14)")
        .argParser(Number)
        .conflicts("sessions"),
    )
    .option("--sessions", "Read recent sessions instead of the overview", false)
    .addOption(
      new Option(
        "--limit <limit>",
        "Recent sessions, 1–25 (default: 8); requires --sessions",
      ).argParser(Number),
    )
    .option("--json", "Print one machine-readable JSON document", false)
    .action(
      async (
        game: string,
        options: {
          platformUrl?: string;
          days?: number;
          sessions: boolean;
          limit?: number;
          json: boolean;
        },
      ) => {
        if (options.limit !== undefined && !options.sessions) {
          throw new Error("--limit requires --sessions.");
        }
        if (options.sessions) {
          const sessions = await getPlatformGameAnalyticsSessions({
            platformUrl: options.platformUrl,
            slugOrId: game,
            limit: options.limit,
          });
          if (options.json) {
            process.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
          } else {
            console.log(`Recent sessions: ${sessions.length}`);
            for (const session of sessions) {
              console.log(
                `${session.roomId}  ${session.startedAt}  peak controllers: ${session.peakConcurrentControllers}  controller seconds: ${session.controllerSeconds}`,
              );
            }
          }
          return;
        }
        const overview = await getPlatformGameAnalyticsOverview({
          platformUrl: options.platformUrl,
          slugOrId: game,
          days: options.days,
        });
        if (options.json) {
          process.stdout.write(`${JSON.stringify(overview, null, 2)}\n`);
        } else {
          console.log(`Gameplay over ${overview.days} days`);
          console.log(`Sessions: ${overview.totals.sessionCount}`);
          console.log(
            `Peak controllers: ${overview.totals.peakConcurrentControllers}`,
          );
          console.log(
            `Game active seconds: ${overview.totals.totalGameActiveSeconds}`,
          );
          console.log(
            `Controller seconds: ${overview.totals.totalControllerSeconds}`,
          );
          console.log(
            `Eligible playtime seconds: ${overview.totals.totalEligiblePlaytimeSeconds}`,
          );
          console.log(
            `Last activity: ${overview.totals.lastActivityAt ?? "none"}`,
          );
        }
      },
    );
};
