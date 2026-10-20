interface WelcomeCardProps {
  onTryDemo: () => void;
}

/**
 * Greets a first-time visitor on the sign-in page with the way in that needs no account. It sits
 * with the sign-in options rather than over them.
 */
export function WelcomeCard({ onTryDemo }: WelcomeCardProps) {
  return (
    <section
      aria-labelledby="welcome-title"
      className="welcome-in mx-auto -mt-3 mb-8 flex w-full max-w-sm flex-col items-center gap-3 rounded-panel bg-panel p-4 text-center sm:max-w-md"
    >
      <h2 id="welcome-title" className="text-lg font-bold text-ink">
        New to Album Wall?
      </h2>
      <button
        type="button"
        onClick={onTryDemo}
        className="rounded-control bg-accent px-6 py-2 font-medium text-on-accent hover:bg-accent-hover"
      >
        Try the demo
      </button>
    </section>
  );
}
