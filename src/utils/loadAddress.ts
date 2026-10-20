const PARAM = "user";
const MAX_NAME_LENGTH = 100;

/**
 * Reads the collection named in the address (`?user=<name>`), so a link can open one directly.
 *
 * @param search The address's query string, such as `?user=someone`.
 * @returns The name, or `null` when the address names none.
 */
export function userFromAddress(search: string): string | null {
  const name = new URLSearchParams(search).get(PARAM)?.trim() ?? "";
  return name && name.length <= MAX_NAME_LENGTH ? name : null;
}

/**
 * Puts the loaded collection's name in the address (or takes it out), without adding a history
 * entry and keeping the rest of the address, so the page can be bookmarked or shared as it is.
 *
 * @param name The collection on the wall, or `null` for none (the demo).
 */
export function setAddressUser(name: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (name) url.searchParams.set(PARAM, name);
    else url.searchParams.delete(PARAM);
    if (url.href !== window.location.href)
      window.history.replaceState(window.history.state, "", url);
  } catch {
    // An address that cannot be changed (a sandboxed frame) is left as it is.
  }
}
