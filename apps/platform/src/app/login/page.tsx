import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";
import { PREVIEW_TESTER_CREDENTIALS } from "@/lib/preview-tester-credentials";
import { LoginScreen } from "./login-screen";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextValue = resolvedSearchParams?.next;
  const nextPath = Array.isArray(nextValue) ? nextValue[0] : nextValue;

  // Surface the preview tester credentials to the client only when the
  // server itself is running in a Railway PR preview. Production
  // builds never serialize them — the prop comes through as null.
  const deploymentConfig = resolvePlatformDeploymentConfig(process.env);
  const previewTester = deploymentConfig.isRailwayPreviewEnvironment
    ? {
        email: PREVIEW_TESTER_CREDENTIALS.email,
        password: PREVIEW_TESTER_CREDENTIALS.password,
      }
    : null;

  return <LoginScreen nextPath={nextPath} previewTester={previewTester} />;
}
