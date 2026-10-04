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
    expect(root.className).toContain("bg-page");
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
