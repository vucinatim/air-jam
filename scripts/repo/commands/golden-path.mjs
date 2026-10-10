import { runGoldenPathBootstrap } from "../lib/golden-path-bootstrap.mjs";

export const registerGoldenPathCommands = (program) => {
  const goldenPathCommand = program
    .command("golden-path")
    .description("Validate standalone creator installation and agent tooling");

  goldenPathCommand
    .command("bootstrap")
    .description(
      "Prove candidate package installation and MCP discovery through an isolated registry",
    )
    .option("--template <id>", "Scaffold template to prove", "minimal")
    .option("--keep-workspace", "Retain the run-owned temporary workspace")
    .option("--json", "Print stable JSON")
    .action(async (options) => {
      const result = await runGoldenPathBootstrap({
        template: options.template,
        keepWorkspace: options.keepWorkspace === true,
        onProgress: (stage) => {
          process.stderr.write(`[golden-path bootstrap] ${stage}\n`);
        },
      });
      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      console.log(
        `Golden-path bootstrap passed for ${result.project.name} with ${result.discovery.mcpTools.length} MCP tools.`,
      );
      if (result.retainedWorkspace) {
        console.log(`Retained workspace: ${result.retainedWorkspace}`);
      }
    });
};
