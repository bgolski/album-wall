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

  it("offers folders only to someone who made folders of their own", () => {
    const account = {
      username: "vinylfan",
      busy: false,
      status: "idle" as const,
      error: null,
      onSignIn: vi.fn(),
      onSignOut: vi.fn(),
    };
    const props = {
      username: "vinylfan",
      isPending: false,
      usernameError: null,
      onUsernameChange: vi.fn(),
      onLoadCollection: vi.fn(),
      onFolderChange: vi.fn(),
      account,
    };
    const builtIn = [
      { id: 0, name: "All", count: 75 },
      { id: 1, name: "Uncategorized", count: 75 },
    ];
    const { rerender } = render(<SearchInput {...props} folders={builtIn} />);
    expect(screen.queryByLabelText("Folder")).toBeNull();
    rerender(
      <SearchInput {...props} folders={[...builtIn, { id: 7, name: "Wall picks", count: 9 }]} />
    );
    expect(screen.getByLabelText("Folder")).toBeTruthy();
  });
});

describe("SearchInput with a collection on the wall", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function shownSetup(
    props: { usernameError?: string | null; account?: boolean; demo?: boolean } = {}
  ) {
    const onLoadCollection = vi.fn();
    const onLoadOwn = vi.fn();
    const onTryDemo = vi.fn();
    render(
      <SearchInput
        username="vinylfan"
        isPending={false}
        usernameError={props.usernameError ?? null}
        onUsernameChange={vi.fn()}
        onLoadCollection={onLoadCollection}
        onTryDemo={props.demo ? onTryDemo : undefined}
        account={
          props.account
            ? {
                username: "me",
                busy: false,
                status: "idle",
                error: null,
                onSignIn: vi.fn(),
                onSignOut: vi.fn(),
                onLoadOwn,
              }
            : undefined
        }
        shown={{ username: "vinylfan", albumCount: 12, isDemo: false }}
      />
    );
    return { onLoadCollection, onLoadOwn, onTryDemo };
  }

  const openButton = () => screen.getByRole("button", { name: "Open another collection" });

  it("is one line with a small search button, and no box until it is pressed", () => {
    shownSetup();
    expect(screen.getByText(/12 albums/)).toBeTruthy();
    expect(openButton().textContent).toBe("");
    expect(screen.queryByLabelText("Discogs username")).toBeNull();
  });

  it("opens an empty box over the page, and loads the name typed there", () => {
    const { onLoadCollection } = shownSetup();
    fireEvent.click(openButton());
    const input = screen.getByLabelText("Discogs username") as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: " another " } });
    fireEvent.click(screen.getByRole("button", { name: "Load Collection" }));
    expect(onLoadCollection).toHaveBeenCalledWith("another");
    expect(screen.queryByLabelText("Discogs username")).toBeNull();
  });

  it("stays open with the reason when the name cannot be used", () => {
    const { onLoadCollection } = shownSetup({ usernameError: "Invalid username format." });
    fireEvent.click(openButton());
    fireEvent.change(screen.getByLabelText("Discogs username"), { target: { value: "bad name" } });
    fireEvent.click(screen.getByRole("button", { name: "Load Collection" }));
    expect(onLoadCollection).toHaveBeenCalledWith("bad name");
    expect(screen.getByLabelText("Discogs username")).toBeTruthy();
    expect(screen.getByText("Invalid username format.")).toBeTruthy();
  });

  it("closes with Escape and when something else is pressed", () => {
    shownSetup();
    fireEvent.click(openButton());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("Discogs username")).toBeNull();
    fireEvent.click(openButton());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByLabelText("Discogs username")).toBeNull();
  });

  it("offers a way back to your own collection and the demo in the box", () => {
    const { onLoadOwn, onTryDemo } = shownSetup({ account: true, demo: true });
    fireEvent.click(openButton());
    fireEvent.click(screen.getByRole("button", { name: "My collection" }));
    expect(onLoadOwn).toHaveBeenCalledTimes(1);
    fireEvent.click(openButton());
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(onTryDemo).toHaveBeenCalledTimes(1);
  });

  it("offers neither when there is no account and no demo", () => {
    shownSetup();
    fireEvent.click(openButton());
    expect(screen.queryByRole("button", { name: "My collection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Demo" })).toBeNull();
  });
});
