import { Album, SharedWallState } from "@/types";

export const DEMO_COLLECTION_USERNAME = "demo";
export const DEMO_COLLECTION_LABEL = "Demo Collection";

function buildDiscogsSearchUrl(artist: string, title: string): string {
  return `https://www.discogs.com/search/?q=${encodeURIComponent(`${artist} ${title}`)}&type=all`;
}

/**
 * Curated 4x4 album wall used to demonstrate the app without requiring a Discogs account.
 */
export const DEMO_COLLECTION_ALBUMS: Album[] = [
  {
    id: 900001,
    artist: "Kanye West",
    title: "Graduation",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/39/25/2d/39252d65-2d50-b991-0962-f7a98a761271/00602517483507.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/39/25/2d/39252d65-2d50-b991-0962-f7a98a761271/00602517483507.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Kanye West", "Graduation"),
    genre: ["Hip Hop"],
    year: "2007",
  },
  {
    id: 900002,
    artist: "Led Zeppelin",
    title: "Led Zeppelin IV",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Led Zeppelin", "Led Zeppelin IV"),
    genre: ["Rock"],
    year: "1971",
  },
  {
    id: 900003,
    artist: "Baby Keem",
    title: "The Melodic Blue",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c5/28/0e/c5280eeb-0a5e-9906-3bcf-0cebfe06e318/886449597543.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c5/28/0e/c5280eeb-0a5e-9906-3bcf-0cebfe06e318/886449597543.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Baby Keem", "The Melodic Blue"),
    genre: ["Hip Hop"],
    year: "2021",
  },
  {
    id: 900004,
    artist: "Kendrick Lamar",
    title: "good kid, m.A.A.d city",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Kendrick Lamar", "good kid, m.A.A.d city"),
    genre: ["Hip Hop"],
    year: "2012",
  },
  {
    id: 900005,
    artist: "Tame Impala",
    title: "The Slow Rush",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/e3/e7/65e3e740-b69f-f5cb-f2e6-7dedb5265ac9/19UMGIM96748.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/e3/e7/65e3e740-b69f-f5cb-f2e6-7dedb5265ac9/19UMGIM96748.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Tame Impala", "The Slow Rush"),
    genre: ["Psychedelic Rock"],
    year: "2020",
  },
  {
    id: 900006,
    artist: "The Beatles",
    title: "Abbey Road",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("The Beatles", "Abbey Road"),
    genre: ["Rock"],
    year: "1969",
  },
  {
    id: 900007,
    artist: "The Beatles",
    title: "Let It Be",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5f/ff/9a/5fff9a6a-bb13-6507-5e68-2793ef798834/21UMGIM61121.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5f/ff/9a/5fff9a6a-bb13-6507-5e68-2793ef798834/21UMGIM61121.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("The Beatles", "Let It Be"),
    genre: ["Rock"],
    year: "1970",
  },
  {
    id: 900008,
    artist: "Dua Lipa",
    title: "Future Nostalgia",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e9/c5/a8/e9c5a8a0-d698-137b-2e85-cf3a8d9548f8/190295303372.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e9/c5/a8/e9c5a8a0-d698-137b-2e85-cf3a8d9548f8/190295303372.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Dua Lipa", "Future Nostalgia"),
    genre: ["Disco", "Pop"],
    year: "2020",
  },
  {
    id: 900009,
    artist: "Jessie Ware",
    title: "What's Your Pleasure?",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/47/03/39/47033970-a97a-e001-c84f-05365bd02f18/20UMGIM08956.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/47/03/39/47033970-a97a-e001-c84f-05365bd02f18/20UMGIM08956.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Jessie Ware", "What's Your Pleasure?"),
    genre: ["Disco", "Pop"],
    year: "2020",
  },
  {
    id: 900010,
    artist: "RUFUS DU SOL",
    title: "SOLACE",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/14/50/c8/1450c820-3cb3-ac9f-1bbf-0137d4344452/093624903192.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/14/50/c8/1450c820-3cb3-ac9f-1bbf-0137d4344452/093624903192.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("RUFUS DU SOL", "SOLACE"),
    genre: ["Electronic"],
    year: "2018",
  },
  {
    id: 900011,
    artist: "RUFUS DU SOL",
    title: "Surrender",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b9/42/6e/b9426e49-20c1-97fb-3682-a7f22653792f/093624884736.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b9/42/6e/b9426e49-20c1-97fb-3682-a7f22653792f/093624884736.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("RUFUS DU SOL", "Surrender"),
    genre: ["Electronic"],
    year: "2022",
  },
  {
    id: 900012,
    artist: "Daft Punk",
    title: "Discovery",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Daft Punk", "Discovery"),
    genre: ["Electronic"],
    year: "2001",
  },
  {
    id: 900013,
    artist: "Daft Punk",
    title: "Random Access Memories",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Daft Punk", "Random Access Memories"),
    genre: ["Electronic"],
    year: "2013",
  },
  {
    id: 900014,
    artist: "Arctic Monkeys",
    title: "AM",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/cc/0f/2d/cc0f2d02-5ff1-10e7-eea2-76863a55dbad/887828031795.png/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/cc/0f/2d/cc0f2d02-5ff1-10e7-eea2-76863a55dbad/887828031795.png/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Arctic Monkeys", "AM"),
    genre: ["Rock"],
    year: "2013",
  },
  {
    id: 900015,
    artist: "Kid Cudi",
    title: "Man on the Moon: The End of Day",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/c5/bb/ae/c5bbae2c-68ce-4efe-e0fa-2ee8769e46f3/09UMGIM33418.rgb.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/c5/bb/ae/c5bbae2c-68ce-4efe-e0fa-2ee8769e46f3/09UMGIM33418.rgb.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Kid Cudi", "Man on the Moon: The End of Day"),
    genre: ["Hip Hop"],
    year: "2009",
  },
  {
    id: 900016,
    artist: "Justice",
    title: "†",
    cover_image:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/e0/8c/68e08c2d-0176-7790-5aa4-26da7d688c72/5056556115564_cover.jpg/600x600bb.jpg",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/e0/8c/68e08c2d-0176-7790-5aa4-26da7d688c72/5056556115564_cover.jpg/600x600bb.jpg",
    discogsUrl: buildDiscogsSearchUrl("Justice", "Cross"),
    genre: ["Electronic"],
    year: "2007",
  },
];

/**
 * Default share-state payload used to open the curated demo collection as a compact 4x4 wall.
 */
export const DEMO_SHARED_WALL_STATE: SharedWallState = {
  v: 1,
  username: DEMO_COLLECTION_USERNAME,
  rows: 4,
  columns: 4,
  wallAlbumIds: DEMO_COLLECTION_ALBUMS.map((album) => String(album.id)),
  pinnedAlbumIds: [],
};
