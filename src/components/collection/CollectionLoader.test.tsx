import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CollectionLoader } from "./CollectionLoader";

// Screen reader users get no feedback while a collection loads unless the
// loading message is a live region; the spinner itself is decoration.
describe("CollectionLoader", () => {
  afterEach(cleanup);

  it("announces the loading message politely", () => {
    render(<CollectionLoader username="vinylfan" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Loading vinylfan's collection");
  });

  it("hides the spinner from assistive technology", () => {
    const { container } = render(<CollectionLoader username="vinylfan" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");
  });

  it("still falls back to a generic name", () => {
    render(<CollectionLoader />);
    expect(screen.getByRole("status").textContent).toContain("Loading user's collection");
  });
});
