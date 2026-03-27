import { codeToHtml } from "shiki";

type LandingCodeBlockProps = {
  code: string;
  lang?: string;
};

/**
 * Server-rendered Shiki code block for landing page snippets.
 * Replaces the two separate proof-code components with one parameterised version.
 */
export const LandingCodeBlock = async ({
  code,
  lang = "tsx",
}: LandingCodeBlockProps) => {
  const html = await codeToHtml(code, {
    lang,
    theme: "one-dark-pro",
  });

  return (
    <div
      className="landing-sdk-snippet w-full min-w-0 [&_pre]:m-0 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[11px] [&_pre]:leading-relaxed sm:[&_pre]:text-xs md:[&_pre]:text-[13px]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
