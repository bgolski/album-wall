import type { Metadata } from "next";
import Link from "next/link";
import { DISCOGS_APPLICATIONS_URL } from "@/account/discogsSignIn";
import { RemoveSavedWalls } from "@/components/account/RemoveSavedWalls";

export const metadata: Metadata = {
  title: "Privacy - Album Wall",
  description: "What Album Wall stores, where, for how long, and how to remove it.",
  alternates: { canonical: "privacy/" },
};

const UPDATED = "15 October 2026";
const ISSUES_URL = "https://github.com/bgolski/album-wall/issues";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2"
    >
      {children}
    </a>
  );
}

/**
 * The privacy policy: what Album Wall stores, where and for how long, who else is involved, and
 * how to remove it. Linked from the footer.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-page px-4 py-8 text-ink">
      <article className="mx-auto max-w-2xl space-y-8 leading-relaxed text-muted">
        <header className="space-y-2">
          <Link href="/" className="text-sm text-accent hover:underline">
            ← Album Wall
          </Link>
          <h1 className="text-3xl font-bold text-ink">Privacy</h1>
          <p className="text-sm">Last updated {UPDATED}</p>
        </header>

        <p>
          Album Wall is a free tool for planning a record wall from a Discogs collection. It has no
          accounts of its own, no advertising, no analytics and no tracking cookies.
        </p>

        <Section title="What stays in your browser">
          <p>
            Your walls, saved walls, settings and recently loaded collections are kept in your own
            browser and are not sent to us, unless you are signed in (see below). Clearing this
            site&apos;s data in your browser removes them.
          </p>
        </Section>

        <Section title="Signing in with Discogs">
          <p>
            Signing in is optional. Discogs asks you to allow Album Wall to read your collection and
            gives your browser a key, which is kept in your browser and used to load your collection
            and to keep your saved walls in your account. We do not store it, and we never see your
            Discogs password. Sign out removes the key from your browser; you can also withdraw
            access in your <External href={DISCOGS_APPLICATIONS_URL}>Discogs settings</External>.
          </p>
        </Section>

        <section id="saved-walls" className="space-y-3">
          <h2 className="text-xl font-bold text-ink">Saved walls in your account</h2>
          <p>
            While you are signed in, your saved walls and the walls you marked as on your wall are
            also kept on our server under your Discogs username, so they load on any device you sign
            in on. They are kept until you remove them here. Copies in your browsers stay; a device
            that is still signed in saves its copy again, so sign out there first.
          </p>
          <RemoveSavedWalls />
        </section>

        <Section title="Shared links">
          <p>
            When you share a wall, the link holds the collection&apos;s username and the records on
            the wall, and anyone with the link can see it. Short links are deleted after one year.
          </p>
        </Section>

        <Section title="What we do not keep">
          <p>
            We do not keep a record of who visits or which collections are loaded, and we do not
            sell or share information with anyone. Our hosting providers may keep standard technical
            logs, such as IP addresses, for security.
          </p>
        </Section>

        <Section title="Discogs">
          <p>
            Collections come from Discogs, and signing in happens on Discogs, under the{" "}
            <External href="https://www.discogs.com/help/doc/privacy-policy">
              Discogs privacy policy
            </External>
            .
          </p>
        </Section>

        <Section title="Changes and questions">
          <p>
            If this page changes, the date above will change with it. Questions are welcome on{" "}
            <External href={ISSUES_URL}>GitHub</External>.
          </p>
        </Section>
      </article>
    </main>
  );
}
