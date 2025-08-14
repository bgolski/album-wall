export interface Album {
  id: number;
  title: string;
  cover_image?: string;
  artist: string;
  genre?: string[];
  year?: string;
  coverUrl?: string;
  error?: boolean;
}

// Define HTML2Canvas options interface for type casting
export interface Html2CanvasOptions {
  backgroundColor?: string;
  scale?: number;
  logging?: boolean;
  allowTaint?: boolean;
  useCORS?: boolean;
  background?: string;
}

// Extend window here if you add global helpers in the future
