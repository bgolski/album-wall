interface AppContainerProps {
  children: React.ReactNode;
}

/**
 * Provides the main page layout container for the application.
 */
export function AppContainer({ children }: AppContainerProps) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-page px-3 py-4 text-ink sm:p-4">
      <div className="w-full max-w-6xl mx-auto">{children}</div>
    </div>
  );
}
