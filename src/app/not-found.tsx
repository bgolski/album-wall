import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-page text-ink">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="mb-4">The page you are looking for doesn&apos;t exist or has been moved.</p>
        <Link
          href="/"
          className="px-4 py-2 bg-accent text-on-accent rounded-control hover:bg-accent-hover"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
