import Link from "next/link";

interface FooterProps {
  ownerName?: string;
}

/**
 * Renders the footer: the copyright line and a link to the privacy page.
 */
export function Footer({ ownerName = "Bradley Golski" }: FooterProps) {
  return (
    <footer className="mt-8 py-4 text-center text-muted text-sm border-t border-line">
      <p>
        © {new Date().getFullYear()} {ownerName}
        <span aria-hidden="true"> · </span>
        <Link href="/privacy/" className="underline underline-offset-2 hover:text-ink">
          Privacy
        </Link>
      </p>
    </footer>
  );
}
