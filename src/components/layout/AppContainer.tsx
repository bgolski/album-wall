interface AppContainerProps {
  children: React.ReactNode;
}

/**
 * Provides the main page layout container for the application.
 */
export function AppContainer({ children }: AppContainerProps) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 px-3 py-4 text-white sm:p-4">
      <div className="w-full max-w-6xl mx-auto">{children}</div>
    </main>
  );
}
