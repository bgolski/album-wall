/**
 * Tells the user their Discogs collection has no records to show.
 */
export function EmptyCollection() {
  return (
    <div className="mb-10 flex flex-col items-center justify-center rounded-panel bg-panel px-6 py-12 text-center">
      <h3 className="text-xl font-bold text-ink">No records here</h3>
    </div>
  );
}
