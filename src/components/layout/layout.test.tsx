import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AppContainer } from "./AppContainer";
import { Footer } from "./Footer";

afterEach(cleanup);

describe("AppContainer", () => {
  it("renders its children", () => {
    const { getByText } = render(
      <AppContainer>
        <p>wall</p>
      </AppContainer>
    );
    expect(getByText("wall")).toBeTruthy();
  });

  it("does not add a second main landmark (the root layout already has one)", () => {
    const { container } = render(
      <AppContainer>
        <p>wall</p>
      </AppContainer>
    );
    expect(container.querySelector("main")).toBeNull();
  });

  it("keeps the page layout classes", () => {
    const { container } = render(
      <AppContainer>
        <p>wall</p>
      </AppContainer>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
    // The page colour comes from the body, so the record behind the page shows through.
    expect(root.className).not.toContain("bg-page");
  });

  it("puts a decorative record behind the page, hidden from assistive technology", () => {
    const { container } = render(
      <AppContainer>
        <p>wall</p>
      </AppContainer>
    );
    const backdrop = container.querySelector(".record-backdrop");
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop?.querySelector(".record-backdrop__disc")).not.toBeNull();
  });
});

describe("Footer", () => {
  it("is a footer element with the copyright line", () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain(`© ${new Date().getFullYear()} Bradley Golski`);
  });

  it("shows the given owner name and keeps its styling", () => {
    const { container } = render(<Footer ownerName="Ada Lovelace" />);
    const footer = container.querySelector("footer");
    expect(footer?.textContent).toContain("Ada Lovelace");
    expect(footer?.className).toContain("border-t");
  });
});

describe("Footer privacy link", () => {
  it("links to the privacy page", () => {
    const { getByRole } = render(<Footer />);
    // The static build adds the trailing slash (trailingSlash in next.config).
    expect(getByRole("link", { name: "Privacy" }).getAttribute("href")).toMatch(/^\/privacy\/?$/);
  });
});
