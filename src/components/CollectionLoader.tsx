interface CollectionLoaderProps {
  username?: string;
}

export const CollectionLoader = ({ username = "user" }: CollectionLoaderProps) => (
  <div className="mb-10 flex flex-col items-center justify-center py-12 px-4">
    <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-blue-500 mb-4"></div>
    <p className="text-lg text-gray-300">Loading {username}&apos;s collection...</p>
    <p className="text-sm text-gray-400 mt-2">
      This may take a moment depending on collection size
    </p>
  </div>
);
