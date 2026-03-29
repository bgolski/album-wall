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

// HTML2Canvas options interface for type casting
export interface Html2CanvasOptions {
  backgroundColor?: string;
  scale?: number;
  logging?: boolean;
  allowTaint?: boolean;
  useCORS?: boolean;
  background?: string;
}
