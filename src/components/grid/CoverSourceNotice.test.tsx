import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { reportCoverLoad, resetCoverSource } from "@/covers/coverSource";
import { CoverSourceNotice } from "./CoverSourceNotice";

afterEach(() => {
  cleanup();
  act(() => resetCoverSource());
});

const fail = (source: "service" | "proxy") =>
  act(() => {
    for (let i = 0; i < 4; i += 1) reportCoverLoad(source, false);
  });
const failBoth = () => {
  fail("service");
  fail("proxy");
};

describe("CoverSourceNotice", () => {
  it("shows nothing while the image proxy works, even with the app's image service down", () => {
    render(<CoverSourceNotice />);
    expect(screen.queryByText(/Covers may load slowly/)).toBeNull();
    fail("service");
    expect(screen.queryByText(/Covers may load slowly/)).toBeNull();
  });

  it("explains when the proxy is down, as covers the image service does not serve load directly", () => {
    render(<CoverSourceNotice />);
    fail("proxy");
    expect(screen.getByText(/Covers may load slowly/)).toBeTruthy();
  });

  it("explains when covers load directly, and can be dismissed", () => {
    render(<CoverSourceNotice />);
    failBoth();
    expect(screen.getByText(/Covers may load slowly/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Covers may load slowly/)).toBeNull();
  });

  it("goes away when the proxy is back", () => {
    render(<CoverSourceNotice />);
    failBoth();
    act(() => resetCoverSource());
    expect(screen.queryByText(/Covers may load slowly/)).toBeNull();
  });
});
