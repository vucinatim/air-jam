import { LandingCodeBlock } from "@/components/landing/landing-code-block";
import { sdkSnippet, storeSnippet } from "@/components/landing/landing-content";
import { LandingPage } from "@/components/landing/landing-page";
import { redirect } from "next/navigation";

const equationSnippet = `type AirJam = AirPlay & GameJam;`;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string | string[] }>;
}) {
  const params = await searchParams;
  const login = params.login;
  const wantsLogin =
    login === "true" || (Array.isArray(login) && login.includes("true"));
  if (wantsLogin) {
    redirect("/login");
  }

  return (
    <LandingPage
      equationCodeBlock={
        <LandingCodeBlock
          code={equationSnippet}
          lang="typescript"
          transparent
        />
      }
      sdkProofCodes={[
        <LandingCodeBlock key="sdk-config" code={sdkSnippet} />,
        <LandingCodeBlock key="sdk-store" code={storeSnippet} />,
      ]}
    />
  );
}
