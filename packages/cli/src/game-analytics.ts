import {
  getPlatformGameAnalyticsOverview,
  getPlatformGameAnalyticsSessions,
} from "@air-jam/devtools/platform-game-analytics";
import { Command } from "commander";

export const registerGameAnalyticsCommand = (gameCommand: Command) => {
  const analyticsCommand = gameCommand
    .command("analytics")
    .description("Read creator gameplay analytics for an owned game");

  analyticsCommand
    .command("overview")
    .description("Read the gameplay overview")
    .requiredOption("--game <slug-or-id>", "Owned game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--days <days>", "Overview window, 1–90 days (default: 14)", Number)
    .option("--json", "Print one machine-readable JSON document", false)
    .action(
      async (options: {
        game: string;
        platformUrl?: string;
        days?: number;
        json: boolean;
      }) => {
        const overview = await getPlatformGameAnalyticsOverview({
          platformUrl: options.platformUrl,
          slugOrId: options.game,
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

  analyticsCommand
    .command("sessions")
    .description("Read recent gameplay sessions")
    .requiredOption("--game <slug-or-id>", "Owned game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--limit <limit>", "Recent sessions, 1–25 (default: 8)", Number)
    .option("--json", "Print one machine-readable JSON document", false)
    .action(
      async (options: {
        game: string;
        platformUrl?: string;
        limit?: number;
        json: boolean;
      }) => {
        const sessions = await getPlatformGameAnalyticsSessions({
          platformUrl: options.platformUrl,
          slugOrId: options.game,
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
      },
    );
};
