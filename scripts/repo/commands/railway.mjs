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

const summarizeServiceInstance = (instance) => {
  const customDomains = instance.domains?.customDomains ?? [];
  const serviceDomains = instance.domains?.serviceDomains ?? [];

  return {
    serviceId: instance.serviceId,
    serviceName: instance.serviceName,
    railwayConfigFile: instance.railwayConfigFile ?? null,
    rootDirectory: instance.rootDirectory ?? null,
    startCommand: instance.startCommand ?? null,
    healthcheckPath: instance.healthcheckPath ?? null,
    deployment: instance.latestDeployment
      ? {
          id: instance.latestDeployment.id,
          status: instance.latestDeployment.status,
          staticUrl: instance.latestDeployment.staticUrl ?? null,
          url: instance.latestDeployment.url ?? null,
        }
      : null,
    customDomains: customDomains.map((entry) => entry.domain),
    serviceDomains: serviceDomains.map((entry) => entry.domain),
  };
};

const isManagedApplicationService = (summary) => {
  return Boolean(summary.railwayConfigFile);
};

const formatServiceStatus = (summary) => {
  const deploymentStatus = summary.deployment?.status ?? "missing";
  const publicDomains = [...new Set([
    ...summary.customDomains,
    ...summary.serviceDomains,
    summary.deployment?.staticUrl ?? null,
  ].filter(Boolean))];

  return [
    `${summary.serviceName}: ${deploymentStatus}`,
    summary.railwayConfigFile
      ? `  config: ${summary.railwayConfigFile}`
      : null,
    summary.healthcheckPath ? `  health: ${summary.healthcheckPath}` : null,
    publicDomains.length > 0 ? `  public: ${publicDomains.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

export const registerRailwayCommands = (program) => {
  const railwayCommand = program
    .command("railway")
    .description("Repo-owned Railway Public API helpers");

  railwayCommand
    .command("doctor")
    .description("Summarize the canonical Railway deployment surface for this repo")
    .option("--project <id>", "Railway project id")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      const projectId = resolveProjectId(options);
      if (!projectId) {
        throw new Error("Missing --project and no RAILWAY_PROJECT_ID is set.");
      }

      const client = createRailwayApiClient();
      const project = await client.getProject(projectId);
      const environments = await client.listEnvironments({ projectId });
      const primaryEnvironmentId =
        project.primaryEnvironmentId ??
        project.baseEnvironmentId ??
        environments.find((entry) => entry.name === "production")?.id ??
        null;

      if (!primaryEnvironmentId) {
        throw new Error(
          `Could not resolve the primary Railway environment for project ${project.name}.`,
        );
      }

      const primaryEnvironment = await client.getEnvironment(primaryEnvironmentId);
      const allServiceSummaries = primaryEnvironment.serviceInstances.map(
        summarizeServiceInstance,
      );
      const applicationServices = allServiceSummaries.filter(
        isManagedApplicationService,
      );
      const infrastructureServices = allServiceSummaries.filter(
        (summary) => !isManagedApplicationService(summary),
      );

      const result = {
        project: {
          id: project.id,
          name: project.name,
          workspace: project.workspace?.name ?? null,
          prDeploys: Boolean(project.prDeploys),
          focusedPrEnvironments: Boolean(project.focusedPrEnvironments),
          botPrEnvironments: Boolean(project.botPrEnvironments),
          baseEnvironmentId: project.baseEnvironmentId ?? null,
          primaryEnvironmentId: project.primaryEnvironmentId ?? null,
        },
        environments: {
          primary: {
            id: primaryEnvironment.id,
            name: primaryEnvironment.name,
            isEphemeral: primaryEnvironment.isEphemeral,
          },
          ephemeral: environments
            .filter((entry) => entry.isEphemeral)
            .map((entry) => ({
              id: entry.id,
              name: entry.name,
            })),
        },
        applicationServices,
        infrastructureServices: infrastructureServices.map((summary) => ({
          serviceId: summary.serviceId,
          serviceName: summary.serviceName,
          deployment: summary.deployment,
        })),
      };

      if (options.json) {
        printJson(result);
        return;
      }

      console.log(`${result.project.name} (${result.project.id})`);
      console.log(`Workspace: ${result.project.workspace ?? "-"}`);
      console.log(
        `Primary environment: ${result.environments.primary.name} (${result.environments.primary.id})`,
      );
      console.log(
        `PR environments: ${result.project.prDeploys ? "enabled" : "disabled"}`,
      );
      console.log(
        `Focused PR environments: ${result.project.focusedPrEnvironments ? "enabled" : "disabled"}`,
      );
      console.log(
        `Bot PR environments: ${result.project.botPrEnvironments ? "enabled" : "disabled"}`,
      );
      console.log(
        `Open ephemeral environments: ${result.environments.ephemeral.map((entry) => entry.name).join(", ") || "none"}`,
      );
      console.log("");

      console.log(
        `Managed application services: ${applicationServices.length}`,
      );
      console.log(`Infrastructure services: ${infrastructureServices.length}`);
      console.log("");

      for (const summary of applicationServices) {
        console.log(formatServiceStatus(summary));
        console.log("");
      }
    });

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
