import { track } from "@/types/song.type";
import axios from "axios";

export const fetchSavedTracks = async (accessToken: string) => {
  try {
    const response = await axios.get("https://api.spotify.com/v1/me/tracks", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        limit: 10, // Fetch the first 10 saved tracks
      },
    });
    return response.data.items; // Array of saved tracks
  } catch (error: any) {
    console.error("Error fetching saved tracks:", error);
    throw error;
  }
};

export const searchSongs = async (accessToken: string, query: string) => {
  try {
    const response = await axios.get("https://api.spotify.com/v1/search", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        q: query.trim(), // Search query (e.g., song name)
        type: "track", // Search for tracks
        limit: 10, // Fetch the first 10 results
      },
    });
    console.log("searchSongs", response);
    return response.data.tracks.items.map((track: track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name).join(", "),
      album: {
        name: track.album.name,
        imageUrl: track.album.images?.[1]?.url || "", // Use medium-sized image
      },
      previewUrl: track.preview_url || null,
      popularity: track.popularity,
      uri: track.uri,
    }));
  } catch (error: any) {
    console.error("Error searching for songs:", error);
    throw error;
  }
};
