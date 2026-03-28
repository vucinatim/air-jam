import { codeToHtml } from "shiki";

type LandingCodeBlockProps = {
  code: string;
  lang?: string;
  transparent?: boolean;
};

/**
 * Server-rendered Shiki code block for landing page snippets.
 * Replaces the two separate proof-code components with one parameterised version.
 */
export const LandingCodeBlock = async ({
  code,
  lang = "tsx",
  transparent = false,
}: LandingCodeBlockProps) => {
  const html = await codeToHtml(code, {
    lang,
    theme: "one-dark-pro",
  });

  return (
    <div
      className={`landing-sdk-snippet w-full min-w-0 [&_pre]:m-0 [&_pre]:p-4 ${transparent ? "[&_pre]:bg-transparent!" : ""} [&_pre]:font-mono [&_pre]:text-[11px] [&_pre]:leading-relaxed sm:[&_pre]:text-xs md:[&_pre]:text-[13px]`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
