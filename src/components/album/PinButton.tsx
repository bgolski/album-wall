interface PinButtonProps {
  isPinned: boolean;
  title: string;
  disabled?: boolean;
  hidden?: boolean;
  onToggle: () => void;
}

/**
 * Shows the pin badge for an album. Pinned albums always show it; others show it on hover or
 * keyboard focus. Activating it pins or unpins the album without opening the album sheet.
 */
export function PinButton({
  isPinned,
  title,
  disabled = false,
  hidden = false,
  onToggle,
}: PinButtonProps) {
  if (disabled || hidden) return null;

  return (
    <button
      type="button"
      aria-pressed={isPinned}
      aria-label={`${isPinned ? "Unpin" : "Pin"} ${title}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`absolute top-2 right-2 w-6 h-6 rounded-full z-10 flex items-center justify-center transition-opacity ${
        isPinned
          ? "bg-blue-500"
          : "bg-gray-800/70 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      }`}
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4 text-white"
      >
        {isPinned ? (
          <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
        ) : (
          <path d="M17 3H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v6h2.03v-6H19v-2c-1.66 0-3-1.34-3-3V5h1c.55 0 1-.45 1-1s-.45-1-1-1zm-6 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        )}
      </svg>
    </button>
  );
}
