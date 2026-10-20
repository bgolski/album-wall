import { SubmitButton } from "../ui/SubmitButton";
import { SearchField } from "../ui/SearchField";

interface UsernameFormProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the name as typed when the form is sent. */
  onSubmit: () => void;
  isPending: boolean;
  /** Why the name cannot be used, shown under the field. */
  error: string | null;
  autoFocus?: boolean;
}

/**
 * The username field: the app's search field with the Load button inside it, and the reason
 * underneath when a name cannot be used.
 */
export function UsernameForm({
  value,
  onChange,
  onSubmit,
  isPending,
  error,
  autoFocus = false,
}: UsernameFormProps) {
  const disabled = isPending || !value.trim();
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) onSubmit();
        }}
        className="mx-auto w-full max-w-sm sm:max-w-md"
      >
        <SearchField
          id="discogs-username"
          label="Discogs username"
          value={value}
          onChange={onChange}
          placeholder="Discogs username"
          autoComplete="username"
          disabled={isPending}
          autoFocus={autoFocus}
          invalid={Boolean(error)}
          describedBy={error ? "discogs-username-error" : undefined}
        >
          <SubmitButton disabled={disabled} isLoading={isPending} />
        </SearchField>
      </form>
      {error && (
        <p
          id="discogs-username-error"
          className="mx-auto mt-2 w-full max-w-sm text-left text-sm text-danger sm:max-w-md"
        >
          {error}
        </p>
      )}
    </>
  );
}
