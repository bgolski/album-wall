import { describe, expect, it } from "vitest";
import type { Album } from "@/types";
import type { CoverProfile } from "@/utils/coverProfile";
import { hexToOklab } from "@/utils/gradientTargets";
import {
  buildGradientWall,
  fitLightnessToCollection,
  mainColorFit,
  gradientStops,
  wallTargets,
} from "./buildGradientWall";
import { makeAlbum } from "@/test/fixtures";

// A cover that is one flat color all over.
function flat(hex: string): CoverProfile {
  const color = hexToOklab(hex)!;
  return { color, palette: [{ color, share: 1 }], regions: Array.from({ length: 9 }, () => color) };
}

const album = (id: number, artist = `Artist ${id}`): Album =>
  makeAlbum(id, { title: `T${id}`, artist });

function build(
  covers: [Album, CoverProfile | null][],
  options: {
    rows: number;
    columns: number;
    colors: string[];
    angle?: number;
    pinned?: string[];
    keepArtistsApart?: boolean;
  }
) {
  return buildGradientWall({
    albums: covers.map(([a]) => a),
    rows: options.rows,
    columns: options.columns,
    pinned: new Set(options.pinned ?? []),
    profiles: Object.fromEntries(covers.map(([a, profile]) => [String(a.id), profile])),
    gradient: { colors: options.colors, angle: options.angle ?? 90 },
    keepArtistsApart: options.keepArtistsApart ?? false,
  });
}

const ids = (albums: Album[]) => albums.map((a) => a.id);

describe("buildGradientWall", () => {
  it("puts the covers that match the gradient in order along it, from the whole collection", () => {
    const result = build(
      [
        [album(1), flat("#808080")],
        [album(2), flat("#0000ff")],
        [album(3), flat("#ff0000")],
        [album(4), flat("#00ff00")],
        // Like any real collection, it runs from dark covers to light ones.
        [album(5), flat("#000000")],
        [album(6), flat("#ffffff")],
      ],
      { rows: 1, columns: 2, colors: ["#ff0000", "#0000ff"] }
    );
    expect(ids(result.albums)).toEqual([3, 2, 1, 4, 5, 6]);
  });

  it("follows the direction: top to bottom puts the first color on the top row", () => {
    const result = build(
      [
        [album(1), flat("#0000ff")],
        [album(2), flat("#ff0000")],
      ],
      { rows: 2, columns: 1, colors: ["#ff0000", "#0000ff"], angle: 180 }
    );
    expect(ids(result.albums)).toEqual([2, 1]);
  });

  it("leaves pinned covers where they are", () => {
    const result = build(
      [
        [album(1), flat("#0000ff")],
        [album(2), flat("#ff0000")],
        [album(3), flat("#ff0000")],
      ],
      { rows: 1, columns: 2, colors: ["#ff0000", "#0000ff"], pinned: ["1"] }
    );
    expect(result.albums[0]!.id).toBe(1);
    expect(result.albums[1]!.id).toBe(2);
  });

  it("keeps the pool in its previous order and every album exactly once", () => {
    const covers: [Album, CoverProfile | null][] = [
      [album(1), flat("#ffffff")],
      [album(2), flat("#ff0000")],
      [album(3), flat("#000000")],
      [album(4), flat("#00ff00")],
      [album(5), flat("#0000ff")],
    ];
    const result = build(covers, { rows: 1, columns: 2, colors: ["#ff0000", "#00ff00"] });
    expect(ids(result.albums).slice(0, 2)).toEqual([2, 4]);
    expect(ids(result.albums).slice(2)).toEqual([1, 3, 5]);
  });

  it("puts covers with no readable color on the wall only when nothing else is left, and counts them", () => {
    const result = build(
      [
        [album(1), null],
        [album(2), flat("#ff0000")],
        [album(3), flat("#0000ff")],
      ],
      { rows: 1, columns: 2, colors: ["#ff0000", "#0000ff"] }
    );
    expect(ids(result.albums)).toEqual([2, 3, 1]);
    expect(result.unmeasured).toBe(1);
  });

  it("keeps covers by the same artist from touching when asked", () => {
    // Two reds by one artist would sit side by side for a red wall; a third red is available.
    const covers: [Album, CoverProfile | null][] = [
      [album(1, "Same"), flat("#ff0000")],
      [album(2, "same "), flat("#fe0000")],
      [album(3, "Other"), flat("#f00000")],
    ];
    const apart = build(covers, {
      rows: 1,
      columns: 2,
      colors: ["#ff0000", "#ff0000"],
      keepArtistsApart: true,
    });
    const wall = apart.albums.slice(0, 2).map((a) => a.artist.trim().toLowerCase());
    expect(wall[0]).not.toBe(wall[1]);
    expect(apart.artistConflicts).toBe(0);
  });

  it("reports same-artist pairs it cannot separate", () => {
    const result = build(
      [
        [album(1, "Same"), flat("#ff0000")],
        [album(2, "Same"), flat("#ff0000")],
      ],
      { rows: 1, columns: 2, colors: ["#ff0000", "#ff0000"], keepArtistsApart: true }
    );
    expect(result.artistConflicts).toBe(1);
  });

  it("calls a wall far from the gradient a loose match", () => {
    const result = build(
      [
        [album(1), flat("#000000")],
        [album(2), flat("#000000")],
      ],
      { rows: 1, columns: 2, colors: ["#ffffff", "#ffff00"] }
    );
    expect(result.match).toBe("loose");
  });

  it("leaves the collection alone when there are no usable colors in the gradient", () => {
    const albums = [album(1), album(2)];
    const result = buildGradientWall({
      albums,
      rows: 1,
      columns: 2,
      pinned: new Set(),
      profiles: {},
      gradient: { colors: ["nope"], angle: 90 },
      keepArtistsApart: false,
    });
    expect(result.albums).toBe(albums);
  });
});

describe("gradient helpers", () => {
  it("spreads stops evenly and skips colors that are not hex", () => {
    expect(gradientStops(["#000000", "bad", "#ffffff"]).map((stop) => stop.at)).toEqual([0, 1]);
    expect(gradientStops(["#000000", "#808080", "#ffffff"]).map((stop) => stop.at)).toEqual([
      0, 0.5, 1,
    ]);
  });

  it("gives one target color per spot", () => {
    expect(wallTargets({ colors: ["#000000", "#ffffff"], angle: 90 }, 2, 3)).toHaveLength(6);
  });
});

describe("fitting the gradient to the collection", () => {
  const grey = (l: number): CoverProfile => {
    const color = { l, a: 0, b: 0 };
    return {
      color,
      palette: [{ color, share: 1 }],
      regions: Array.from({ length: 9 }, () => color),
    };
  };

  it("maps the gradient's darkest and lightest onto the collection's", () => {
    const samples = [[{ l: 0, a: 0, b: 0 }], [{ l: 0.5, a: 0.1, b: 0 }], [{ l: 1, a: 0, b: 0 }]];
    const fitted = fitLightnessToCollection(samples, [grey(0.2), grey(0.5), grey(0.8)]);
    expect(fitted.map((tile) => Number(tile[0]!.l.toFixed(2)))).toEqual([0.2, 0.5, 0.8]);
    // Hue is left alone.
    expect(fitted[1]![0]!.a).toBe(0.1);
  });

  it("orders mid-dark covers along a black-to-white gradient instead of treating them all as too light", () => {
    // No cover is anywhere near black; without fitting, the darker half would be placed by chance.
    const covers: [Album, CoverProfile | null][] = [0.62, 0.3, 0.5, 0.38, 0.7, 0.45].map(
      (l, index) => [album(index + 1), grey(l)]
    );
    const result = build(covers, { rows: 1, columns: 6, colors: ["#000000", "#ffffff"] });
    expect(ids(result.albums)).toEqual([2, 4, 6, 3, 1, 5]);
  });

  it("counts the covers that share a one-color wall's hue", () => {
    const result = build(
      [
        [album(1), flat("#1565c0")],
        [album(2), flat("#ff0000")],
        [album(3), flat("#42a5f5")],
        [album(4), flat("#808080")],
      ],
      { rows: 1, columns: 2, colors: ["#1976d2", "#1976d2"] }
    );
    expect(result.coversOfColor).toBe(2);
  });

  it("does not count for a gradient of several hues or a neutral one", () => {
    const covers: [Album, CoverProfile | null][] = [[album(1), flat("#1565c0")]];
    expect(
      build(covers, { rows: 1, columns: 1, colors: ["#ff0000", "#0000ff"] }).coversOfColor
    ).toBeNull();
    expect(
      build(covers, { rows: 1, columns: 1, colors: ["#111111", "#111111"] }).coversOfColor
    ).toBeNull();
  });
});

describe("seeing a cover's main colors", () => {
  it("sees a pink cover with a dark portrait as pink, not as the mauve its ninths average to", () => {
    // Like IGOR: a pink background around a dark portrait. Its ninths average to mauve-grey, but its
    // biggest color is pink.
    const pink = hexToOklab("#df9eba")!;
    const dark = hexToOklab("#211f25")!;
    const blur = hexToOklab("#7b6270")!;
    const portrait: CoverProfile = {
      color: pink,
      palette: [
        { color: pink, share: 0.45 },
        { color: dark, share: 0.4 },
        { color: blur, share: 0.15 },
      ],
      regions: [pink, blur, pink, blur, dark, blur, blur, dark, blur],
    };
    const spot = hexToOklab("#e91e63")!;
    expect(mainColorFit(portrait, spot)).toBeLessThan(mainColorFit(flat("#7a5f74"), spot));
  });

  it("ignores small details when finding a cover's main colors", () => {
    const black = hexToOklab("#111111")!;
    const red = hexToOklab("#ff0000")!;
    const logo: CoverProfile = {
      color: red,
      palette: [
        { color: black, share: 0.92 },
        { color: red, share: 0.08 },
      ],
      regions: Array.from({ length: 9 }, () => black),
    };
    expect(mainColorFit(logo, red)).toBeGreaterThan(mainColorFit(flat("#cc3333"), red));
  });
});

describe("buildGradientWall with an extra cost", () => {
  it("passes over a cover that costs more when an equally good one is free", () => {
    const covers: [Album, CoverProfile | null][] = [
      [album(1), flat("#ff0000")],
      [album(2), flat("#ff0000")],
      [album(3), flat("#000000")],
      [album(4), flat("#ffffff")],
    ];
    const plain = build(covers, { rows: 1, columns: 1, colors: ["#ff0000", "#ff0000"] });
    expect(plain.albums[0]!.id).toBe(1);
    const rested = buildGradientWall({
      albums: covers.map(([a]) => a),
      rows: 1,
      columns: 1,
      pinned: new Set(),
      profiles: Object.fromEntries(covers.map(([a, p]) => [String(a.id), p])),
      gradient: { colors: ["#ff0000", "#ff0000"], angle: 90 },
      keepArtistsApart: false,
      extraCost: { "1": 0.08 },
    });
    expect(rested.albums[0]!.id).toBe(2);
  });
});
