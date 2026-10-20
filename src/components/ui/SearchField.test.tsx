import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PoolSearch } from "../grid/PoolSearch";
import { UsernameForm } from "../search/UsernameForm";

afterEach(cleanup);

// The two search fields in the app are the same shape: a rounded pill with a magnifier, the text
// and room for a button at the end.
const fieldOf = (input: HTMLElement) => input.parentElement!;

describe("search fields", () => {
  it("share one shape", () => {
    render(
      <>
        <PoolSearch query="" onQueryChange={vi.fn()} />
        <UsernameForm
          value=""
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          isPending={false}
          error={null}
        />
      </>
    );
    const fields = [screen.getByLabelText("Search"), screen.getByLabelText("Discogs username")].map(
      fieldOf
    );
    for (const field of fields) {
      expect(field.className).toContain("rounded-full");
      expect(field.querySelector("svg")).not.toBeNull();
    }
    expect(fields[0]!.className.split(" ").filter((name) => name.startsWith("rounded"))).toEqual(
      fields[1]!.className.split(" ").filter((name) => name.startsWith("rounded"))
    );
  });

  it("clears the pool search from a button inside the field", () => {
    const onQueryChange = vi.fn();
    render(<PoolSearch query="abba" onQueryChange={onQueryChange} />);
    const field = fieldOf(screen.getByLabelText("Search"));
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(field.contains(screen.getByRole("button", { name: "Clear search" }))).toBe(true);
  });

  it("outlines the username field in red when it has a problem", () => {
    render(
      <UsernameForm
        value="x"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isPending={false}
        error="No such user"
      />
    );
    expect(fieldOf(screen.getByLabelText("Discogs username")).className).toContain("border-danger");
  });
});
