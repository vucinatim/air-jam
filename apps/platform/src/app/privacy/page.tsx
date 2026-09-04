import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Telemetry and Privacy",
  description:
    "What Air Jam's website telemetry records, avoids, retains, and reports.",
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <h2 className="text-foreground text-xl font-semibold tracking-tight">
      {title}
    </h2>
    <div className="text-muted-foreground space-y-3 leading-7">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34rem)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16 sm:py-24">
        <header className="space-y-4">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Air Jam
          </Link>
          <div className="space-y-3">
            <p className="text-primary text-sm font-medium tracking-wide uppercase">
              Public telemetry disclosure
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Telemetry and privacy
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg leading-8">
              Air Jam uses a small first-party telemetry system to understand
              whether people and agents find and use the product. This page
              describes that system—nothing broader.
            </p>
            <p className="text-muted-foreground text-sm">
              Last updated September 4, 2026
            </p>
          </div>
        </header>

        <Section title="What is recorded">
          <p>
            Air Jam records visits to a bounded page path, selected product
            actions such as opening the quick start or entering the Arcade, a
            normalized referrer host and campaign values when present, the
            deployment environment, and event timestamps. The server may infer a
            broad human, bot, or agent class and an allowlisted agent family
            from request headers.
          </p>
          <p>
            A random identifier groups events only within the current browser
            page context. It is held in memory and disappears when that context
            ends. It is an approximate browsing-session measure, not a durable
            identity or a count of unique people.
          </p>
        </Section>

        <Section title="What is not recorded as telemetry">
          <p>
            Air Jam does not persist raw IP addresses, full user-agent strings,
            full URLs or query strings, raw referrers, email or account IDs,
            search text, arbitrary metadata, or browser fingerprints in this
            telemetry system.
          </p>
          <p>
            Telemetry does not use cookies, local storage, or session storage. A
            transient request-derived key may rate-limit abuse, but neither the
            address nor that key is stored as telemetry.
          </p>
        </Section>

        <Section title="How long it is kept">
          <p>
            Air Jam’s policy is to retain raw telemetry events for 90 days.
            Daily records used to avoid counting the same ephemeral session
            twice have the same 90-day limit after their aggregate is stable.
            Aggregate daily counts are retained long-term.
          </p>
          <p>
            The deletion operation is implemented and available to Air Jam
            operators. Recurring enforcement belongs to Air Jam’s separately
            deployed operational worker; that worker is not active in production
            yet and must be activated and observed before the 1.0 release. Once
            active, a failed retention run makes worker readiness fail until a
            later run succeeds.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Only authorized Air Jam operators can access telemetry reporting.
            The product dashboard receives aggregate counts, not raw telemetry
            rows. Product telemetry is kept separate from account lifecycle and
            authoritative gameplay-usage data.
          </p>
        </Section>

        <Section title="Scope of this page">
          <p>
            This is a precise disclosure for Air Jam’s public product telemetry,
            not a complete hosted-account privacy policy. Accounts,
            authentication providers, gameplay usage, submitted reports, and
            uploaded media have separate data lifecycles. Air Jam will not make
            broader retention, export, or deletion promises until those paths
            are implemented and independently proven.
          </p>
        </Section>
      </div>
    </main>
  );
}
