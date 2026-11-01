/**
 * Solves the assignment problem: gives each row its own column so the total cost is as small as
 * possible (the Hungarian algorithm, using shortest augmenting paths with potentials). There must
 * be at least as many columns as rows.
 *
 * @param cost `cost[row][column]`, every row the same length.
 * @returns For each row, the index of its column.
 */
export function solveAssignment(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0]!.length;
  if (m < n) throw new Error("solveAssignment needs at least as many columns as rows");
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const match = new Array<number>(m + 1).fill(0); // match[column] = row, 1-based; 0 = free
  const way = new Array<number>(m + 1).fill(0);

  for (let row = 1; row <= n; row += 1) {
    match[0] = row;
    let column0 = 0;
    const minimum = new Array<number>(m + 1).fill(Infinity);
    const used = new Array<boolean>(m + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = match[column0]!;
      let delta = Infinity;
      let column1 = 0;
      for (let column = 1; column <= m; column += 1) {
        if (used[column]) continue;
        const reduced = cost[row0 - 1]![column - 1]! - u[row0]! - v[column]!;
        if (reduced < minimum[column]!) {
          minimum[column] = reduced;
          way[column] = column0;
        }
        if (minimum[column]! < delta) {
          delta = minimum[column]!;
          column1 = column;
        }
      }
      for (let column = 0; column <= m; column += 1) {
        if (used[column]) {
          u[match[column]!]! += delta;
          v[column]! -= delta;
        } else {
          minimum[column]! -= delta;
        }
      }
      column0 = column1;
    } while (match[column0] !== 0);
    do {
      const column1 = way[column0]!;
      match[column0] = match[column1]!;
      column0 = column1;
    } while (column0 !== 0);
  }

  const result = new Array<number>(n).fill(-1);
  for (let column = 1; column <= m; column += 1) {
    if (match[column] !== 0) result[match[column]! - 1] = column - 1;
  }
  return result;
}
