/**
 * Export frame presets and helper to fit content into a frame.
 *
 * The export frame presets represent common output target dimensions.  They are
 * intended for use by the UI when offering users a pre‑configured frame size.
 */

/**
 * A preset describing a target export frame.
 *
 * @property id - Identifier used for lookup.  Must be one of "phone", "desktop", or "square".
 * @property label - Human readable name shown to the user.
 * @property width - Target width in pixels.
 * @property height - Target height in pixels.
 */
export interface ExportPreset {
  id: "phone" | "desktop" | "square";
  label: string;
  width: number;
  height: number;
}

/**
 * The list of export frame presets.  The order matters because UI components
 * rely on the presets being in the same order as the tests expect.
 */
export const EXPORT_PRESETS: readonly ExportPreset[] = [
  { id: "phone", label: "Phone wallpaper", width: 1179, height: 2556 },
  { id: "desktop", label: "Desktop wallpaper", width: 2560, height: 1440 },
  { id: "square", label: "Square print", width: 3000, height: 3000 },
];

/**
 * Scale content to fit within a frame while preserving aspect ratio.
 *
 * @param contentWidth - Width of the content to fit.
 * @param contentHeight - Height of the content to fit.
 * @param frameWidth - Target frame width.
 * @param frameHeight - Target frame height.
 * @param padding - Optional padding on all sides of the frame.
 * @returns An object containing the scaled width, height, top‑left coordinates
 *          and the applied scale factor.
 * @throws {RangeError} If any dimension is non‑positive or the frame cannot
 *          accommodate the content with the requested padding.
 */
export function fitIntoFrame(
  contentWidth: number,
  contentHeight: number,
  frameWidth: number,
  frameHeight: number,
  padding = 0
) {
  if (contentWidth <= 0 || contentHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    throw new RangeError("All dimensions must be positive");
  }
  if (padding < 0) {
    throw new RangeError("Padding must be non‑negative");
  }

  const availWidth = frameWidth - 2 * padding;
  const availHeight = frameHeight - 2 * padding;
  if (availWidth <= 0 || availHeight <= 0) {
    throw new RangeError("Frame too small for the requested padding");
  }

  const scale = Math.min(availWidth / contentWidth, availHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  const x = padding + (availWidth - width) / 2;
  const y = padding + (availHeight - height) / 2;

  return { x, y, width, height, scale };
}
