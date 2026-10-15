interface EmptyCollectionProps {
  username: string;
}

/**
 * Tells the user their Discogs collection has no records to show.
 */
export function EmptyCollection({ username }: EmptyCollectionProps) {
  return (
    <div className="mb-10 flex flex-col items-center justify-center rounded-panel bg-panel px-6 py-12 text-center">
      <h3 className="mb-2 text-xl font-bold text-ink">No records here yet</h3>
      <p className="text-muted">
        {username ? `${username} has` : "This account has"} no records in this Discogs collection or
        folder. Add records on Discogs, then load it again.
      </p>
    </div>
  );
}
