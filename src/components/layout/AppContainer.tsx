interface AppContainerProps {
  children: React.ReactNode;
}

/**
 * Provides the main page layout container for the application: a slowly turning record behind
 * the page, and a column that grows on very wide screens so they are not left mostly empty.
 */
export function AppContainer({ children }: AppContainerProps) {
  return (
    <div className="flex min-h-screen flex-col items-center px-3 py-4 text-ink sm:p-4">
      <div aria-hidden="true" className="record-backdrop">
        <div className="record-backdrop__spin">
          <div className="record-backdrop__disc" />
        </div>
      </div>
      <div className="app-intro mx-auto w-full max-w-6xl 3xl:max-w-[2800px]">{children}</div>
    </div>
  );
}
