import { describe, expect, it } from "vitest";
import type { Album } from "@/types";
import { baseArtist, baseTitle, pressingKey, showEachAlbumOnce } from "./groupPressings";

let nextId = 1;
const album = (artist: string, title: string): Album => ({ id: nextId++, artist, title });
const same = (a: [string, string], b: [string, string]) =>
  pressingKey(album(...a)) === pressingKey(album(...b));

describe("pressingKey with master ids", () => {
  const withMaster = (artist: string, title: string, masterId?: number): Album => ({
    id: nextId++,
    artist,
    title,
    ...(masterId ? { masterId } : {}),
  });

  it("groups pressings by master id even when the titles differ", () => {
    const first = withMaster("Todd Rundgren", "Utopia", 100);
    const second = withMaster("Todd Rundgren", "Utopia (Limited Edition Silver Vinyl)", 100);
    expect(pressingKey(first)).toBe(pressingKey(second));
    expect(pressingKey(withMaster("Beatles", "Abbey Road", 7))).toBe(
      pressingKey(withMaster("The Beatles", "Abbey Road (Mono)", 7))
    );
  });

  it("keeps self-titled albums by one artist apart when their master ids differ", () => {
    expect(pressingKey(withMaster("Weezer", "Weezer", 1))).not.toBe(
      pressingKey(withMaster("Weezer", "Weezer", 2))
    );
    const { groups } = showEachAlbumOnce([
      withMaster("Weezer", "Weezer", 1),
      withMaster("Weezer", "Weezer", 2),
      withMaster("Weezer", "Weezer", 3),
    ]);
    expect(groups).toEqual([]);
  });

  it("falls back to artist and title when an album has no master id", () => {
    expect(pressingKey(withMaster("Nirvana", "Nevermind"))).toBe(
      pressingKey(withMaster("Nirvana", "Nevermind (180g)"))
    );
  });
});

describe("pressingKey", () => {
  it("treats editions of an album as the same album", () => {
    expect(same(["Travis Scott", "Utopia"], ["Travis Scott", "Utopia"])).toBe(true);
    expect(same(["The Beatles", "Abbey Road (Remastered)"], ["The Beatles", "Abbey Road"])).toBe(
      true
    );
    expect(
      same(["The Beatles", "Abbey Road - 50th Anniversary Edition"], ["Beatles", "Abbey Road"])
    ).toBe(true);
    expect(same(["Fleetwood Mac", "Rumours [Deluxe]"], ["Fleetwood Mac", "Rumours"])).toBe(true);
    expect(same(["Nirvana (2)", "Nevermind (180g)"], ["Nirvana", "Nevermind"])).toBe(true);
    expect(same(["Beyoncé", "Lemonade"], ["Beyonce", "Lemonade"])).toBe(true);
    expect(same(["Simon & Garfunkel", "Bookends"], ["Simon and Garfunkel", "Bookends"])).toBe(true);
  });

  it("keeps different albums apart", () => {
    expect(same(["Led Zeppelin", "Led Zeppelin"], ["Led Zeppelin", "Led Zeppelin II"])).toBe(false);
    expect(same(["Fleetwood Mac", "Rumours Live"], ["Fleetwood Mac", "Rumours"])).toBe(false);
    expect(same(["Tame Impala", "Live Versions"], ["Tame Impala", "Currents"])).toBe(false);
    expect(same(["Queen", "Greatest Hits"], ["Elton John", "Greatest Hits"])).toBe(false);
    expect(
      same(
        ["Calvin Harris", "Funk Wav Bounces Vol. 1"],
        ["Calvin Harris", "Funk Wav Bounces Vol. 2"]
      )
    ).toBe(false);
    expect(
      same(["Kid Cudi", "Man On The Moon (The End Of Day)"], ["Kid Cudi", "Man On The Moon II"])
    ).toBe(false);
  });

  it("normalises titles and artists to plain words", () => {
    expect(baseTitle("Rumours - Deluxe Edition")).toBe("rumours");
    expect(baseTitle("Man On The Moon: The End Of Day")).toBe("man on the moon the end of day");
    expect(baseArtist("The Rolling Stones")).toBe("rolling stones");
  });
});

describe("showEachAlbumOnce", () => {
  const first = album("Travis Scott", "Utopia");
  const other = album("Kid Cudi", "Indicud");
  const second = album("Travis Scott", "Utopia (Clean)");

  it("shows the first pressing in order and sets the others aside", () => {
    const result = showEachAlbumOnce([first, other, second]);
    expect(result.shown).toEqual([first, other]);
    expect(result.hidden).toEqual([second]);
    expect(result.groups).toEqual([[first, second]]);
  });

  it("shows the pressing chosen to stand for the album", () => {
    const result = showEachAlbumOnce([first, other, second], {
      [pressingKey(first)]: String(second.id),
    });
    expect(result.shown).toEqual([other, second]);
    expect(result.hidden).toEqual([first]);
  });
});
