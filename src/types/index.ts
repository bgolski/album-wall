import type { CoverColor } from "@/utils/colorBasics";
import type { CoverProfile } from "@/utils/coverProfile";

export interface Album {
  id: number;
  title: string;
  cover_image?: string;
  coverUrl?: string; // For backward compatibility
  discogsUrl?: string;
  artist: string;
  genre?: string[];
  /** Discogs styles, finer than genres (such as "Hard Rock" or "Neo Soul"). */
  styles?: string[];
  year?: string;
  /** The first record label, without the number Discogs adds to tell labels apart. */
  label?: string;
  /** Format details such as "LP", "Album", "Reissue" or a vinyl color. */
  format?: string[];
  /** When the record was added to the Discogs collection, as an ISO timestamp. */
  dateAdded?: string;
  error?: boolean;
  /** The cover's color when it is already known, such as the demo's precomputed colors. */
  color?: CoverColor;
  /** The cover's measured profile when it is already known, such as the demo's precomputed ones. */
  profile?: CoverProfile;
}

export interface DiscogsRelease {
  id: number;
  basic_information: {
    id?: number;
    title?: string;
    cover_image?: string;
    resource_url?: string;
    artists?: {
      name: string;
      join?: string;
    }[];
    genres?: string[];
    styles?: string[];
    year?: number;
    labels?: { name: string }[];
    formats?: { name?: string; text?: string; descriptions?: string[] }[];
  };
  date_added?: string;
}

export interface DiscogsCollectionResponse {
  pagination?: {
    page?: number;
    pages?: number;
    per_page?: number;
    items?: number;
  };
  releases?: DiscogsRelease[];
}

export interface SharedWallState {
  v: 1;
  username: string;
  rows: number;
  columns: number;
  wallAlbumIds: string[];
  pinnedAlbumIds: string[];
}
