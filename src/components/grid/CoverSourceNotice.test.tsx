import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { reportCoverLoad, resetCoverSource } from "@/utils/coverSource";
import { CoverSourceNotice } from "./CoverSourceNotice";

afterEach(() => {
  cleanup();
  act(() => resetCoverSource());
});

const failProxy = () =>
  act(() => {
    for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
  });

describe("CoverSourceNotice", () => {
  it("shows nothing while the image proxy works", () => {
    render(<CoverSourceNotice />);
    expect(screen.queryByText(/loading directly/)).toBeNull();
  });

  it("explains when covers load directly, and can be dismissed", () => {
    render(<CoverSourceNotice />);
    failProxy();
    expect(screen.getByText(/loading directly because the image service/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/loading directly/)).toBeNull();
  });

  it("goes away when the proxy is back", () => {
    render(<CoverSourceNotice />);
    failProxy();
    act(() => resetCoverSource());
    expect(screen.queryByText(/loading directly/)).toBeNull();
  });
});
