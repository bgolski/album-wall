interface PinButtonProps {
  isPinned: boolean;
  disabled?: boolean;
}

export function PinButton({ isPinned, disabled = false }: PinButtonProps) {
  if (disabled) return null;

  return (
    <div
      className={`absolute top-2 right-2 w-6 h-6 rounded-full z-10 flex items-center justify-center bg-gray-800 bg-opacity-70 ${
        isPinned
          ? "opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500"
          : "opacity-0 group-hover:opacity-100 transition-opacity"
      }`}
    >
      <svg
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
    </div>
  );
}
