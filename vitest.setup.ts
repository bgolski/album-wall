import { afterEach } from "vitest";
import { configure } from "@testing-library/react";

// Waits for the page (waitFor, findBy) get the same allowance as the tests: on a busy machine a
// render that usually takes a few milliseconds can take seconds.
configure({ asyncUtilTimeout: 10_000 });

/** A minimal in-memory Storage for runtimes whose own localStorage hides the jsdom one. */
class MemoryStorage implements Storage {
  #items = new Map<string, string>();

  get length() {
    return this.#items.size;
  }

  clear() {
    this.#items.clear();
  }

  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.#items.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.#items.delete(key);
  }

  setItem(key: string, value: string) {
    this.#items.set(key, String(value));
  }
}

// Node 25 and later define an experimental global localStorage that is undefined unless Node is
// started with --localstorage-file, and it shadows the one jsdom provides.
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof window !== "undefined" && !window[name]) {
    Object.defineProperty(window, name, { value: new MemoryStorage(), configurable: true });
  }
}

// The app remembers walls and recently loaded collections in browser storage, and names the
// collection on the wall in the address; start every test without anything a previous test left
// behind.
afterEach(() => {
  if (typeof window === "undefined") return;
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
