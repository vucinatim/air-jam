import { LoginScreen } from "./login-screen";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextValue = resolvedSearchParams?.next;
  const nextPath = Array.isArray(nextValue) ? nextValue[0] : nextValue;

  return <LoginScreen nextPath={nextPath} />;
}
