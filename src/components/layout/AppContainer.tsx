interface AppContainerProps {
  children: React.ReactNode;
}

/**
 * Provides the main page layout container for the application.
 */
export function AppContainer({ children }: AppContainerProps) {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-6xl mx-auto">{children}</div>
    </main>
  );
}
