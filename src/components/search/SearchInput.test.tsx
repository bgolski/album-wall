import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "./SearchInput";

// The username box needs an accessible name and a tied-in error, and loading
// a collection is a real form submission: Enter and the button both submit it
// once, through the browser's own form handling.
function setup({
  username = "vinylfan",
  isPending = false,
  usernameError = null,
}: { username?: string; isPending?: boolean; usernameError?: string | null } = {}) {
  const onLoadCollection = vi.fn();
  render(
    <SearchInput
      username={username}
      isPending={isPending}
      usernameError={usernameError}
      onUsernameChange={vi.fn()}
      onLoadCollection={onLoadCollection}
    />
  );
  const input = screen.getByLabelText("Discogs username");
  const form = input.closest("form");
  return {
    onLoadCollection,
    input,
    form,
    button: form?.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement,
  };
}

describe("SearchInput", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("has an accessible name", () => {
    const { input } = setup();
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("autocomplete")).toBe("username");
  });

  it("is not marked invalid without an error", () => {
    const { input } = setup();
    expect(input.getAttribute("aria-invalid")).not.toBe("true");
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("ties the error message to the input", () => {
    const { input } = setup({ usernameError: "That username is not valid" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const id = input.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id ?? "")?.textContent).toBe("That username is not valid");
  });

  it("puts the input and the button in one form", () => {
    const { form, button } = setup();
    expect(form).not.toBeNull();
    expect(form?.contains(button)).toBe(true);
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("loads the collection once when the form is submitted, without reloading the page", () => {
    const { form, onLoadCollection } = setup();
    const notPrevented = fireEvent.submit(form as HTMLFormElement);
    expect(notPrevented).toBe(false);
    expect(onLoadCollection).toHaveBeenCalledTimes(1);
  });

  it("loads the collection once when the button is clicked", () => {
    const { button, onLoadCollection } = setup();
    fireEvent.click(button);
    expect(onLoadCollection).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter to the form instead of handling the key itself", () => {
    const { input, onLoadCollection } = setup();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onLoadCollection).not.toHaveBeenCalled();
  });

  it("does not load when the username is blank", () => {
    const { form, onLoadCollection } = setup({ username: "   " });
    fireEvent.submit(form as HTMLFormElement);
    expect(onLoadCollection).not.toHaveBeenCalled();
  });

  it("does not load again while a load is pending, and says it is busy", () => {
    const { form, button, onLoadCollection } = setup({ isPending: true });
    fireEvent.submit(form as HTMLFormElement);
    expect(onLoadCollection).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("is not busy when idle", () => {
    const { button } = setup();
    expect(button.getAttribute("aria-busy")).not.toBe("true");
  });
});
