/**
 * The page's local storage, or null on the server or where the browser refuses it: some browsers
 * throw as soon as the property is read when site data is blocked.
 */
export function localStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The page's session storage, or null where it cannot be used (see localStore).
 */
export function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
