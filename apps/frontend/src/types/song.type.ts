export type track = {
  id: string;
  name: string;
  artists: {
    name: string;
  }[];
  album: {
    name: string;
    imageUrl: string;
    images: { url: string }[];
  };
  preview_url: string;
  popularity: number;
  uri: string;
  length: number;
};
