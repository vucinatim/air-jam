// Ordinary runtime tests must not join a developer's database-backed instance
// fleet or replace its dev-latest log. PostgreSQL tests opt in separately with
// AIR_JAM_TEST_DATABASE_URL; logging tests own explicit temporary collectors.
export const isolateServerTestEnvironment = (env: NodeJS.ProcessEnv): void => {
  delete env.DATABASE_URL;
  delete env.AIR_JAM_DEV_LOG_DIR;
  env.AIR_JAM_DEV_LOG_COLLECTOR = "disabled";
};

isolateServerTestEnvironment(process.env);
