interface EmptyCollectionProps {
  username: string;
}

/**
 * Tells the user their Discogs collection has no records to show.
 */
export function EmptyCollection({ username }: EmptyCollectionProps) {
  return (
    <div className="mb-10 flex flex-col items-center justify-center rounded-lg bg-gray-800 px-6 py-12 text-center">
      <h3 className="mb-2 text-xl font-bold text-white">No records yet</h3>
      <p className="text-gray-300">
        {username ? `${username} has` : "This account has"} no records in their Discogs collection.
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Add records on Discogs, or check that the collection is public, then load it again.
      </p>
    </div>
  );
}
