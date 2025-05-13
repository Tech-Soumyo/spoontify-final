import { prisma } from "@repo/db";
import axios from "axios";
import refreshSpotifyToken from "./refreshToaken";

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
    console.log("Error fetching saved tracks:", error);
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
    console.log("Error searching for songs:", error);
    throw error;
  }
};

export const searchSongs2 = async (roomCode: string, query: string) => {
  if (!roomCode || !query?.trim()) {
    throw new Error("Missing roomCode or empty query");
  }

  try {
    const room = await prisma.room.findUnique({
      where: { roomCode },
      include: { owner: true },
    });

    if (!room) {
      throw new Error("Room not found");
    }

    if (!room.owner.spotifyAccessToken) {
      throw new Error("Room owner not connected to Spotify");
    }

    let accessToken = room.owner.spotifyAccessToken;
    const tokenExpiresAt = room.owner.tokenExpiresAt;

    // Refresh token if expired or expiring soon (within 5 minutes)
    if (
      tokenExpiresAt &&
      new Date() > new Date(Number(tokenExpiresAt) - 5 * 60 * 1000)
    ) {
      if (!room.owner.spotifyRefreshToken) {
        throw new Error("No refresh token available for owner");
      }

      const refreshedToken = await refreshSpotifyToken(
        room.owner.spotifyRefreshToken
      );
      if (!refreshedToken) {
        throw new Error("Failed to refresh token");
      }

      // Update the owner's token in the database
      await prisma.user.update({
        where: { id: room.ownerId },
        data: {
          spotifyAccessToken: refreshedToken.accessToken,
          tokenExpiresAt: new Date(refreshedToken.accessTokenExpires),
        },
      });

      accessToken = refreshedToken.accessToken;
    }

    const response = await axios.get("https://api.spotify.com/v1/search", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        q: query.trim(),
        type: "track",
        limit: 10,
        market: "from_token", // Ensures results are available in owner's market
      },
    });

    if (!response.data?.tracks?.items) {
      throw new Error("Invalid response from Spotify");
    }

    return response.data.tracks.items.map((track: track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name).join(", "),
      album: {
        name: track.album.name,
        imageUrl: track.album.images?.[1]?.url || "",
        images: track.album.images || [],
      },
      previewUrl: track.preview_url || null,
      popularity: track.popularity,
      uri: track.uri,
      duration_ms: track.duration_ms,
    }));
  } catch (error: any) {
    console.error("Error searching for songs:", error);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
};
