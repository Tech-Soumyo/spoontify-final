import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import axios from "axios";
import { prisma } from "@repo/db";

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased to 100 requests per window
});

const router = express.Router();

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  preview_url: string;
  popularity: number;
  uri: string;
  duration_ms: number;
}

export interface FormattedTrack {
  id: string;
  name: string;
  artists: string[];
  album: {
    name: string;
    imageUrl: string;
  };
  previewUrl: string | null;
  popularity: number;
  uri: string;
  duration: number;
}

// Function to refresh Spotify access token
const refreshSpotifyToken = async (refreshToken: string): Promise<string> => {
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Failed to refresh Spotify token:", error);
    throw new Error("Unable to refresh Spotify token");
  }
};

export const searchSongs = async (
  accessToken: string,
  query: string
): Promise<FormattedTrack[]> => {
  if (!query.trim()) {
    return [];
  }

  try {
    const response = await axios.get<{ tracks: { items: SpotifyTrack[] } }>(
      "https://api.spotify.com/v1/search",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          q: query.trim(),
          type: "track",
          limit: 10,
        },
      }
    );

    return response.data.tracks.items.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name),
      album: {
        name: track.album.name,
        imageUrl: track.album.images[0]?.url || "",
      },
      previewUrl: track.preview_url || null,
      popularity: track.popularity,
      uri: track.uri,
      duration: track.duration_ms,
    }));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error("Spotify token expired");
    }
    console.error("Spotify API Error:", error);
    throw new Error("Failed to search songs on Spotify");
  }
};

router.post("/search", searchLimiter, async (req: Request, res: Response) => {
  const { roomCode, query } = req.body;

  if (!roomCode || !query) {
    res.status(400).json({ error: "Missing roomCode or query" });
    return;
  }

  try {
    const room = await prisma.room.findUnique({
      where: { roomCode },
      include: { owner: true },
    });

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (!room.owner.spotifyAccessToken) {
      res.status(400).json({ error: "Room owner not connected to Spotify" });
      return;
    }

    let accessToken = room.owner.spotifyAccessToken;
    const tokenExpiresAt = room.owner.tokenExpiresAt;

    // Check if token is expired
    if (tokenExpiresAt && new Date() > new Date(tokenExpiresAt)) {
      if (!room.owner.spotifyRefreshToken) {
        res.status(400).json({ error: "No refresh token available for owner" });
        return;
      }

      // Refresh the token
      accessToken = await refreshSpotifyToken(room.owner.spotifyRefreshToken);

      // Update the owner's token in the database
      await prisma.user.update({
        where: { id: room.ownerId },
        data: {
          spotifyAccessToken: accessToken,
          tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour expiry
        },
      });
    }

    const results = await searchSongs(accessToken, query);
    res.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to search songs",
    });
  }
});

export default router;
