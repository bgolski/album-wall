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
  year?: string;
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
  };
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
