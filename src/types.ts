export interface Album {
  id: string;
  artist: string;
  title: string;
  coverUrl?: string;
  genre?: string;
  year?: string;
  error?: string;
}

// Define global window interface extension for our exportAlbumWall function
declare global {
  interface Window {
    exportAlbumWall?: (selector: string, filename: string) => Promise<void>;
  }
}
