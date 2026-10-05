import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { ExportPreset } from "@/utils/exportFrame";

interface ExportDropdownProps {
  isOpen: boolean;
  isExporting: boolean;
  canShareLink: boolean;
  menuId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onShareOrSaveImage: () => void;
  presets?: readonly ExportPreset[];
  onExportPreset?: (preset: ExportPreset) => void;
  onShareLink: () => void;
  onCopyShareLink: () => void;
}

/**
 * Displays the export actions as a menu: save or share the wall as an image, share its link, or
 * copy it. Focus moves into the menu when it opens, the arrow keys move between items, and
 * Escape, Tab or a click outside close it and put focus back on the Export button.
 */
export function ExportDropdown({ isOpen, ...menuProps }: ExportDropdownProps) {
  if (!isOpen) return null;
  return <ExportMenu {...menuProps} />;
}

function ExportMenu({
  isExporting,
  canShareLink,
  menuId,
  triggerRef,
  onClose,
  onShareOrSaveImage,
  presets = [],
  onExportPreset,
  onShareLink,
  onCopyShareLink,
}: Omit<ExportDropdownProps, "isOpen">) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const enabledItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
    );

  useEffect(() => {
    enabledItems()[0]?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      // Closing from the keyboard or by choosing an item leaves focus on nothing; hand it back.
      const active = document.activeElement;
      if (!active || active === document.body || menu?.contains(active)) {
        trigger?.focus();
      }
    };
    // The menu mounts once per opening, so these run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = enabledItems();
    const index = items.findIndex((item) => item === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      onClose();
    }
  };

  const itemClass =
    "block w-full text-left px-4 py-2 text-ink hover:bg-raised focus-visible:bg-raised disabled:opacity-50";

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Export options"
      onKeyDown={handleKeyDown}
      className="absolute right-0 z-40 mt-2 w-48 rounded-control bg-panel shadow-lg ring-1 ring-line"
    >
      <div className="py-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => onShareOrSaveImage()}
          disabled={isExporting}
          className={itemClass}
        >
          {isExporting ? "Preparing image..." : "Share or Save Image"}
        </button>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="menuitem"
            onClick={() => onExportPreset?.(preset)}
            disabled={isExporting}
            className={itemClass}
          >
            {preset.label}
            <span className="block text-xs text-muted">
              {preset.width} × {preset.height}
            </span>
          </button>
        ))}
        {canShareLink && (
          <button
            type="button"
            role="menuitem"
            onClick={onShareLink}
            disabled={isExporting}
            className={itemClass}
          >
            Share Link
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={onCopyShareLink}
          disabled={isExporting}
          className={itemClass}
        >
          Copy Share Link
        </button>
      </div>
    </div>
  );
}
