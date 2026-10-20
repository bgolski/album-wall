import type { ReactNode } from "react";

interface SearchFieldProps {
  id: string;
  /** What the field is called for a screen reader (nothing is shown). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** A button at the end of the field, such as Load or Clear. */
  children?: ReactNode;
  type?: "text" | "search";
  disabled?: boolean;
  autoFocus?: boolean;
  /** Marks the field as having a problem (red outline). */
  invalid?: boolean;
  describedBy?: string | undefined;
  autoComplete?: string;
  /** Width and placement of the whole field. */
  className?: string;
}

/**
 * The one search field shape used everywhere in the app: a rounded pill with a magnifier on the
 * left, the text, and room at the end for a button. The text is 16px so iOS Safari does not zoom
 * the page when the field is focused.
 */
export function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
  children,
  type = "text",
  disabled = false,
  autoFocus = false,
  invalid = false,
  describedBy,
  autoComplete = "off",
  className = "",
}: SearchFieldProps) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full border bg-raised py-1 pl-4 pr-1 shadow-sm focus-within:ring-2 focus-within:ring-accent/30 ${
        invalid ? "border-danger" : "border-line focus-within:border-accent"
      } ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-5 w-5 shrink-0 text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-base text-ink placeholder:text-muted focus:outline-hidden [&::-webkit-search-cancel-button]:appearance-none"
      />
      {children}
    </div>
  );
}
