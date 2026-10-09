import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WallDisplay } from "./WallDisplay";
import type { Album } from "@/types";

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  rectSwappingStrategy: vi.fn(),
}));
vi.mock("../album/SortableRecord", () => ({
  SortableRecord: ({ album, imageSize }: { album: Album; imageSize?: number }) => (
    <div data-testid="record" data-album-id={album.id} data-image-size={imageSize} />
  ),
}));

afterEach(cleanup);

const albums: Album[] = [{ id: 1, title: "Test record", artist: "Test artist" }];

function wall(columns: number, isExporting = false) {
  return render(
    <WallDisplay
      albums={albums}
      columns={columns}
      rows={1}
      gridSize={columns}
      pinnedCount={0}
      isExporting={isExporting}
      pinnedAlbums={new Set()}
      onPinToggle={vi.fn()}
      onSelect={vi.fn()}
      moveSourceId={null}
      gridRef={createRef<HTMLDivElement>()}
      showAlbumLabels={false}
    />
  );
}

describe("WallDisplay cover sizing", () => {
  it("requests 320 pixel covers for four or more columns", () => {
    wall(4);
    expect(screen.getByTestId("record").getAttribute("data-image-size")).toBe("320");
  });

  it("keeps full-size covers below four columns", () => {
    wall(3);
    expect(screen.getByTestId("record").hasAttribute("data-image-size")).toBe(false);
  });

  it("keeps full-size covers during export", () => {
    wall(5, true);
    expect(screen.getByTestId("record").hasAttribute("data-image-size")).toBe(false);
  });
});
