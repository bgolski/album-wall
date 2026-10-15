/** A plain vinyl record, used as the sign-in mark (not Discogs' own logo). */
export function RecordIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="var(--color-panel)" strokeOpacity="0.35" />
      <circle
        cx="12"
        cy="12"
        r="5.5"
        fill="none"
        stroke="var(--color-panel)"
        strokeOpacity="0.35"
      />
      <circle cx="12" cy="12" r="3.2" fill="var(--color-accent)" />
      <circle cx="12" cy="12" r="0.9" fill="var(--color-panel)" />
    </svg>
  );
}
