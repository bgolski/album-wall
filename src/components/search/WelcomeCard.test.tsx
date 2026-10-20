import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WelcomeCard } from "./WelcomeCard";

afterEach(cleanup);

describe("WelcomeCard", () => {
  it("is a section of the page, not a dialog, and starts the demo", () => {
    const onTryDemo = vi.fn();
    render(<WelcomeCard onTryDemo={onTryDemo} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "New to Album Wall?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));
    expect(onTryDemo).toHaveBeenCalledTimes(1);
  });
});
