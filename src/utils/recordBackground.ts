// The record from behind the app, drawn for a saved picture: grooves in rings and a soft sheen
// that crosses it, on the app's dark page colour. The numbers follow `.record-backdrop__disc` in
// globals.css.
const PAGE = "#0b0f17";
const GROOVE = "230, 233, 240";
const ACCENT = "129, 140, 248";

/**
 * Draws the record over a canvas, centred.
 *
 * @param context The canvas to draw on.
 * @param width The canvas width in pixels.
 * @param height The canvas height in pixels.
 */
export function drawRecordBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  context.save();
  context.fillStyle = PAGE;
  context.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  // The page's grooves are about 10 pixels apart on a screen about 1000 pixels across.
  const unit = Math.max(1, Math.min(width, height) / 700);
  const reach = Math.hypot(width, height) / 2;

  context.lineWidth = unit;
  for (let at = 4 * unit, n = 0; at < reach; at += 4.5 * unit, n += 1) {
    context.strokeStyle = `rgba(${GROOVE}, ${n % 2 === 0 ? 0.05 : 0.03})`;
    context.beginPath();
    context.arc(centerX, centerY, at, 0, Math.PI * 2);
    context.stroke();
  }

  // Two soft bands of light on opposite sides, as on the page. Older browsers skip them.
  if (typeof context.createConicGradient === "function") {
    const sheen = context.createConicGradient(-Math.PI / 2, centerX, centerY);
    const glow = `rgba(${ACCENT}, 0.1)`;
    const clear = `rgba(${ACCENT}, 0)`;
    for (const [at, color] of [
      [0, clear],
      [25 / 360, glow],
      [55 / 360, clear],
      [180 / 360, clear],
      [205 / 360, glow],
      [235 / 360, clear],
      [1, clear],
    ] as const) {
      sheen.addColorStop(at, color);
    }
    context.fillStyle = sheen;
    context.fillRect(0, 0, width, height);
  }
  context.restore();
}
