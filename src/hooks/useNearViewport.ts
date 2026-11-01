import { useEffect, useState, type RefObject } from "react";

/**
 * Reports whether an element has come within a margin of the viewport, and keeps reporting true
 * afterwards. Browsers' own lazy loading starts fetching a couple of screens ahead, which on a tall
 * phone page still loads most of a large collection at once; a smaller margin holds back the rest.
 *
 * @param rootMargin How far outside the viewport counts as near.
 * @returns Whether the element is, or has been, near the viewport.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  rootMargin: string = "400px"
): boolean {
  const [seen, setSeen] = useState(false);
  const observable = typeof IntersectionObserver !== "undefined";

  useEffect(() => {
    const element = ref.current;
    if (seen || !observable || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen, observable, rootMargin]);

  return seen || !observable;
}
