import axios from "axios";

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
  duration_ms?: number;
};

/**
 * Search for songs using the API route
 * This function can be safely used on the client side as it doesn't directly use Prisma
 */
export const searchSongs = async (
  roomCode: string,
  query: string
): Promise<track[]> => {
  if (!roomCode || !query?.trim()) {
    throw new Error("Missing roomCode or empty query");
  }

  try {
    const response = await axios.post(`/api/spotify/search`, {
      roomCode,
      query: query.trim(),
    });

    if (!response.data?.tracks) {
      throw new Error("Invalid response from server");
    }

    return response.data.tracks;
  } catch (error: any) {
    console.error("Error searching for songs:", error);
    throw new Error(error.response?.data?.error || error.message);
  }
};

export default searchSongs;
