interface FooterProps {
  ownerName?: string;
}

/**
 * Renders the footer copyright line for the application.
 */
export function Footer({ ownerName = "Bradley Golski" }: FooterProps) {
  return (
    <footer className="mt-8 py-4 text-center text-muted text-sm border-t border-line">
      <p>
        © {new Date().getFullYear()} {ownerName}
      </p>
    </footer>
  );
}

export default Footer;
