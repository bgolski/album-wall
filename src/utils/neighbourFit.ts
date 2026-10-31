import type { CoverColor } from "./colorBasics";
import { colorDistance } from "./colorBasics";

export function edgeFit(
  first: (CoverColor | null)[],
  second: (CoverColor | null)[],
  direction: "horizontal" | "vertical",
  fallbackFirst: CoverColor,
  fallbackSecond: CoverColor
): number {
  const indices = direction === "horizontal" ? [2, 5, 8] : [6, 7, 8];
  const counterpart = direction === "horizontal" ? [0, 3, 6] : [0, 1, 2];
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const a = first[indices[i]!] ?? fallbackFirst;
    const b = second[counterpart[i]!] ?? fallbackSecond;
    sum += colorDistance(a, b);
  }
  return sum / 3;
}
