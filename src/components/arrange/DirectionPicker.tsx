import { useId } from "react";

// Compass order, row by row; the middle cell is empty. Angles follow CSS: 0 points up.
const COMPASS: ({ label: string; arrow: string; angle: number } | null)[] = [
  { label: "Toward top left", arrow: "↖", angle: 315 },
  { label: "Bottom to top", arrow: "↑", angle: 0 },
  { label: "Toward top right", arrow: "↗", angle: 45 },
  { label: "Right to left", arrow: "←", angle: 270 },
  null,
  { label: "Left to right", arrow: "→", angle: 90 },
  { label: "Toward bottom left", arrow: "↙", angle: 225 },
  { label: "Top to bottom", arrow: "↓", angle: 180 },
  { label: "Toward bottom right", arrow: "↘", angle: 135 },
];

/**
 * The direction a wall runs in, as a compass of nine buttons with the middle left empty.
 *
 * @param props.angle The chosen CSS angle (0 runs bottom to top, 90 left to right).
 * @param props.onChange Called with the angle of the button pressed.
 */
export function DirectionPicker({
  angle,
  onChange,
}: {
  angle: number;
  onChange: (angle: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <p id={`${id}-direction`} className="mb-1 text-sm text-muted">
        Direction
      </p>
      <div
        role="group"
        aria-labelledby={`${id}-direction`}
        className="grid w-max grid-cols-3 gap-1"
      >
        {COMPASS.map((direction, index) =>
          direction ? (
            <button
              key={direction.angle}
              type="button"
              aria-label={direction.label}
              aria-pressed={angle === direction.angle}
              title={direction.label}
              className={`h-9 w-9 rounded-control text-base transition-colors ${
                angle === direction.angle
                  ? "bg-accent text-on-accent"
                  : "bg-panel text-ink hover:bg-line"
              }`}
              onClick={() => onChange(direction.angle)}
            >
              {direction.arrow}
            </button>
          ) : (
            <span key={`middle-${index}`} aria-hidden="true" />
          )
        )}
      </div>
    </div>
  );
}
