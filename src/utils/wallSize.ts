/**
 * A wall's size as the app writes it everywhere: columns across, then rows down, like an image's
 * width and height.
 *
 * @param columns Covers across.
 * @param rows Covers down.
 * @returns For example "8 \u00d7 4".
 */
export function wallSize(columns: number, rows: number): string {
  return `${columns} \u00d7 ${rows}`;
}
