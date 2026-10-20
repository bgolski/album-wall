/**
 * The loading mark: a small record turning, in whatever color the text around it is. The
 * highlight along one edge is what makes the turning show. Used inside buttons and notices; give
 * it a size and spacing with `className`. For anyone who prefers less motion it turns slowly
 * rather than stopping, since it is the only sign that something is happening.
 *
 * @param props.className Size and spacing; defaults to a small mark that sits before text.
 */
export function LoadingSpinner({ className = "-ml-1 mr-2 h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`animate-spin motion-reduce:[animation-duration:3s] ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <circle cx="12" cy="12" r="7.4" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
