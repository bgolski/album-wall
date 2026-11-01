/**
 * Puts text on the clipboard. The modern clipboard call can refuse (for example when the page
 * is not focused, or the browser wants a fresh tap), so the older copy command is tried next.
 *
 * @returns Whether either way worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused; try the older way.
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "absolute";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  try {
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/**
 * Copies a link, and when the browser will not allow that, shows it in a box the person can
 * copy from themselves.
 *
 * @returns `"copied"`, or `"shown"` when it had to be shown instead.
 */
export async function copyLink(link: string): Promise<"copied" | "shown"> {
  if (await copyText(link)) return "copied";
  window.prompt("Copy this link:", link);
  return "shown";
}
