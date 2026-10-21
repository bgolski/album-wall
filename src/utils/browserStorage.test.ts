import { afterEach, describe, expect, it } from "vitest";
import { localStore, sessionStore } from "./browserStorage";

const names = ["localStorage", "sessionStorage"] as const;
const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(window, name)] as const);

// Some browsers throw as soon as the property is read when site data is blocked.
function refuseStorage() {
  for (const name of names) {
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  }
}

afterEach(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(window, name, descriptor);
    else delete (window as unknown as Record<string, unknown>)[name];
  }
});

describe("browser storage", () => {
  it("returns the page's storage when it can be used", () => {
    expect(localStore()).toBe(window.localStorage);
    expect(sessionStore()).toBe(window.sessionStorage);
  });

  it("returns null instead of throwing when the browser refuses access", () => {
    refuseStorage();
    expect(localStore()).toBeNull();
    expect(sessionStore()).toBeNull();
  });
});
