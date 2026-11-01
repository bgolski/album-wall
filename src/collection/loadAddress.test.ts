import { afterEach, describe, expect, it } from "vitest";
import { setAddressUser, userFromAddress } from "./loadAddress";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("userFromAddress", () => {
  it("reads the name from the query", () => {
    expect(userFromAddress("?user=someone")).toBe("someone");
    expect(userFromAddress("?a=1&user=some.one_2")).toBe("some.one_2");
  });

  it("gives null when there is no usable name", () => {
    expect(userFromAddress("")).toBeNull();
    expect(userFromAddress("?user=")).toBeNull();
    expect(userFromAddress("?user=%20%20")).toBeNull();
    expect(userFromAddress(`?user=${"a".repeat(101)}`)).toBeNull();
  });
});

describe("setAddressUser", () => {
  it("puts the name in the address, keeping the path and the rest of the address", () => {
    window.history.replaceState(null, "", "/album-wall/?x=1#share=abc");
    setAddressUser("someone");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/album-wall/?x=1&user=someone#share=abc"
    );
  });

  it("replaces an earlier name and removes it for no collection", () => {
    window.history.replaceState(null, "", "/?user=first");
    setAddressUser("second");
    expect(window.location.search).toBe("?user=second");
    setAddressUser(null);
    expect(window.location.search).toBe("");
  });

  it("adds no history entry", () => {
    const before = window.history.length;
    setAddressUser("someone");
    setAddressUser("another");
    expect(window.history.length).toBe(before);
  });
});
