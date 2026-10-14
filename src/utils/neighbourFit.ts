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

export function wallEdgeCost(
  order: number[],
  regionsOf: (cover: number) => (CoverColor | null)[],
  fallbackOf: (cover: number) => CoverColor,
  columns: number
): number {
  let total = 0;
  const count = order.length;
  for (let p = 0; p < count; p++) {
    const coverA = order[p];
    if (coverA == null || coverA === -1) continue;
    const regionsA = regionsOf(coverA);
    const fallbackA = fallbackOf(coverA);

    if (p % columns < columns - 1) {
      const q = p + 1;
      if (q < count) {
        const coverB = order[q];
        if (coverB != null && coverB !== -1) {
          const regionsB = regionsOf(coverB);
          const fallbackB = fallbackOf(coverB);
          total += edgeFit(regionsA, regionsB, "horizontal", fallbackA, fallbackB);
        }
      }
    }
    const bq = p + columns;
    if (bq < count) {
      const coverB = order[bq];
      if (coverB != null && coverB !== -1) {
        const regionsB = regionsOf(coverB);
        const fallbackB = fallbackOf(coverB);
        total += edgeFit(regionsA, regionsB, "vertical", fallbackA, fallbackB);
      }
    }
  }
  return total;
}
