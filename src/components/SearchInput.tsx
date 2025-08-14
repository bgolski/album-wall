import React from "react";

interface SearchInputProps {
  username: string;
  isPending: boolean;
  usernameError: string | null;
  error: string | null;
  onUsernameChange: (value: string) => void;
  onLoadCollection: () => void;
}

export const SearchInput = ({
  username,
  isPending,
  usernameError,
  onUsernameChange,
  onLoadCollection,
}: SearchInputProps) => (
  <div className="mb-8 text-center">
    <h1 className="text-3xl font-bold mb-4">Vinyl Wall</h1>
    <p className="mb-6">
      Enter your Discogs username to load your vinyl collection and create a virtual record wall.
    </p>

    <div className="flex flex-col items-center">
      <div className="flex justify-center items-center gap-2 max-w-sm w-full mx-auto">
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onLoadCollection();
          }}
          placeholder="Your Discogs username"
          className={`flex-1 px-4 py-2 rounded-l bg-gray-800 border text-white focus:outline-none focus:border-blue-500 ${
            usernameError ? "border-red-500" : "border-gray-700"
          }`}
          disabled={isPending}
        />
        <button
          onClick={onLoadCollection}
          disabled={isPending || !username}
          className="px-4 py-2 rounded-r bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Loading...
            </>
          ) : (
            "Load Collection"
          )}
        </button>
      </div>

      {usernameError && <p className="text-red-400 text-sm mt-2 max-w-sm">{usernameError}</p>}
    </div>
  </div>
);
