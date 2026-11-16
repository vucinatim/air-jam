import {
  listPlatformMachineSessions,
  revokePlatformMachineSession,
} from "@air-jam/devtools/platform-auth";
import type { Command } from "commander";

export const registerAuthSessionsCommand = (authCommand: Command) => {
  const sessions = authCommand
    .command("sessions")
    .description("List or revoke this account's machine sessions")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(async (options: { platformUrl?: string; json: boolean }) => {
      const result = await listPlatformMachineSessions(options);
      if (options.json)
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else
        for (const session of result.sessions) {
          console.log(
            `${session.id}  ${session.clientName ?? "Air Jam CLI"}  created ${session.createdAt}  last used ${session.lastUsedAt}`,
          );
        }
    });
  sessions
    .command("revoke <id>")
    .description("Revoke one machine session belonging to this account")
    .action(async (id: string, _options: unknown, command: Command) => {
      const options = command.optsWithGlobals<{
        platformUrl?: string;
        json: boolean;
      }>();
      const result = await revokePlatformMachineSession({ ...options, id });
      if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
      else console.log(`Revoked session ${id}.`);
    });
};
