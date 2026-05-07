import {
  createRailwayApiClient,
  resolveRailwayApiToken,
} from "../lib/railway-api.mjs";

const printJson = (value) => {
  console.log(JSON.stringify(value, null, 2));
};

const parseVariablesJson = (value) => {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--variables must be a JSON object.");
  }

  return parsed;
};

const resolveProjectId = (options, env = process.env) => {
  return options.project ?? env.RAILWAY_PROJECT_ID ?? null;
};

export const registerRailwayCommands = (program) => {
  const railwayCommand = program
    .command("railway")
    .description("Repo-owned Railway Public API helpers");

  railwayCommand
    .command("whoami")
    .description("Resolve the active Railway API identity")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const auth = resolveRailwayApiToken();
      const client = createRailwayApiClient();
      const viewer = await client.getCurrentViewer();
      const result = {
        tokenSource: auth.source,
        viewer,
      };

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(`Viewer: ${viewer.name} <${viewer.email}>`);
      console.log(`Token source: ${auth.source ?? "missing"}`);
      console.log(
        `Workspaces: ${viewer.workspaces.map((entry) => entry.name).join(", ") || "none"}`,
      );
    });

  const projectCommand = railwayCommand
    .command("project")
    .description("Railway project inspection");

  projectCommand
    .command("list")
    .description("List accessible Railway projects")
    .option("--workspace <id>", "Workspace id to filter by")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const client = createRailwayApiClient();
      const projects = await client.listProjects({
        workspaceId: options.workspace ?? null,
      });

      if (options.json) {
        printJson(projects);
        return;
      }

      for (const project of projects) {
        console.log(`${project.id}\t${project.name}\t${project.workspace?.name ?? "-"}`);
      }
    });

  projectCommand
    .command("get")
    .description("Inspect one Railway project")
    .requiredOption("--project <id>", "Railway project id")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const client = createRailwayApiClient();
      const project = await client.getProject(options.project);

      if (options.json) {
        printJson(project);
        return;
      }

      console.log(`${project.name} (${project.id})`);
      console.log(`Workspace: ${project.workspace?.name ?? "-"}`);
      console.log(
        `Environments: ${project.environments.map((entry) => entry.name).join(", ") || "none"}`,
      );
      console.log(
        `Services: ${project.services.map((entry) => entry.name).join(", ") || "none"}`,
      );
    });

  const envCommand = railwayCommand
    .command("env")
    .description("Railway environment management");

  envCommand
    .command("list")
    .description("List Railway environments for one project")
    .requiredOption("--project <id>", "Railway project id")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const client = createRailwayApiClient();
      const project = await client.getProject(options.project);
      const environments = project.environments;

      if (options.json) {
        printJson(environments);
        return;
      }

      for (const environment of environments) {
        console.log(
          `${environment.id}\t${environment.name}\t${environment.isEphemeral ? "ephemeral" : "persistent"}`,
        );
      }
    });

  envCommand
    .command("create")
    .description("Create a Railway environment")
    .requiredOption("--project <id>", "Railway project id")
    .requiredOption("--name <name>", "Environment name")
    .option(
      "--source-environment-id <id>",
      "Optional source environment id to duplicate from",
    )
    .option("--ephemeral", "Create an ephemeral environment", false)
    .option(
      "--skip-initial-deploys",
      "Skip the initial deployment pass when duplicating",
      false,
    )
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const client = createRailwayApiClient();
      const environment = await client.createEnvironment({
        projectId: options.project,
        name: options.name,
        sourceEnvironmentId: options.sourceEnvironmentId ?? null,
        ephemeral: Boolean(options.ephemeral),
        skipInitialDeploys: Boolean(options.skipInitialDeploys),
      });

      if (options.json) {
        printJson(environment);
        return;
      }

      console.log(
        `Created environment ${environment.name} (${environment.id})`,
      );
    });

  envCommand
    .command("delete")
    .description("Delete a Railway environment by id")
    .requiredOption("--id <id>", "Railway environment id")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const client = createRailwayApiClient();
      const deleted = await client.deleteEnvironment({
        environmentId: options.id,
      });

      if (options.json) {
        printJson({ deleted });
        return;
      }

      console.log(`Deleted environment ${deleted}`);
    });

  const varsCommand = railwayCommand
    .command("vars")
    .description("Railway variable inspection and mutation");

  varsCommand
    .command("get")
    .description("Get rendered variables for a project/environment/service")
    .requiredOption("--environment <id>", "Railway environment id")
    .option("--project <id>", "Railway project id")
    .option("--service <id>", "Railway service id")
    .option("--unrendered", "Request unrendered values", false)
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const projectId = resolveProjectId(options);
      if (!projectId) {
        throw new Error("Missing --project and no RAILWAY_PROJECT_ID is set.");
      }

      const client = createRailwayApiClient();
      const variables = await client.getVariables({
        projectId,
        environmentId: options.environment,
        serviceId: options.service ?? null,
        unrendered: Boolean(options.unrendered),
      });

      if (options.json) {
        printJson(variables);
        return;
      }

      for (const [key, value] of Object.entries(variables)) {
        console.log(`${key}=${value}`);
      }
    });

  varsCommand
    .command("set")
    .description("Upsert rendered variables for a project/environment/service")
    .requiredOption("--environment <id>", "Railway environment id")
    .requiredOption(
      "--variables <json>",
      "JSON object of key/value pairs to upsert",
    )
    .option("--project <id>", "Railway project id")
    .option("--service <id>", "Railway service id")
    .option("--replace", "Replace the full collection instead of merging", false)
    .option("--allow-deploys", "Allow Railway to deploy immediately", false)
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const projectId = resolveProjectId(options);
      if (!projectId) {
        throw new Error("Missing --project and no RAILWAY_PROJECT_ID is set.");
      }

      const client = createRailwayApiClient();
      const variables = parseVariablesJson(options.variables);
      const updated = await client.upsertVariableCollection({
        projectId,
        environmentId: options.environment,
        serviceId: options.service ?? null,
        variables,
        replace: Boolean(options.replace),
        skipDeploys: !options.allowDeploys,
      });

      if (options.json) {
        printJson({ updated });
        return;
      }

      console.log(
        `Updated ${Object.keys(variables).length} Railway variables (${updated ? "ok" : "no-op"})`,
      );
    });

  return railwayCommand;
};
