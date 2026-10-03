import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchInput } from "./SearchInput";

// The username box relied on its placeholder for a name, which screen
// readers do not reliably announce, and its error was not tied to it.
function setup(usernameError: string | null = null) {
  const onLoadCollection = vi.fn();
  render(
    <SearchInput
      username="vinylfan"
      isPending={false}
      usernameError={usernameError}
      onUsernameChange={vi.fn()}
      onLoadCollection={onLoadCollection}
    />
  );
  return { onLoadCollection, input: screen.getByLabelText("Discogs username") };
}

describe("SearchInput", () => {
  afterEach(cleanup);

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
    const { input } = setup("That username is not valid");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const id = input.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id ?? "")?.textContent).toBe("That username is not valid");
  });

  it("still loads the collection on Enter", () => {
    const { input, onLoadCollection } = setup();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onLoadCollection).toHaveBeenCalledTimes(1);
  });
});
