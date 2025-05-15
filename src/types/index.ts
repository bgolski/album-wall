export interface Album {
  id: number;
  title: string;
  cover_image: string;
  coverUrl: string; // For backward compatibility
  artist: string;
  genre: string[];
  year: string;
}

export interface DiscogsRelease {
  id: number;
  basic_information: {
    title?: string;
    cover_image?: string;
    artists?: {
      name: string;
      join?: string;
    }[];
    genres?: string[];
  };
}

export interface DiscogsImage {
  type: string;
  uri: string;
}

export interface CollectionDisplayProps {
  albums: Album[];
  username: string;
  onAlbumsReorder: (newAlbums: Album[]) => void;
}

export interface ErrorMessageProps {
  error: string;
  username: string;
  onRetry: () => void;
}

export interface CollectionLoaderProps {
  username: string;
}
