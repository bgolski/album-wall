import React from "react";

interface AppContainerProps {
  children: React.ReactNode;
}

export const AppContainer = ({ children }: AppContainerProps) => (
  <main className="flex min-h-screen flex-col items-center p-4 bg-gray-900 text-white">
    <div className="w-full max-w-6xl mx-auto">{children}</div>
  </main>
);
