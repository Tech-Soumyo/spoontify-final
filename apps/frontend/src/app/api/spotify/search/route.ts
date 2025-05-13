import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import axios from "axios";
import refreshSpotifyToken from "@/hooks/refreshToaken";
import { track } from "@/hooks/useSpotifySearch";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomCode, query } = body;

    if (!roomCode || !query?.trim()) {
      return NextResponse.json(
        { error: "Missing roomCode or empty query" },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { roomCode },
      include: { owner: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!room.owner.spotifyAccessToken) {
      return NextResponse.json(
        { error: "Room owner not connected to Spotify" },
        { status: 400 }
      );
    }

    let accessToken = room.owner.spotifyAccessToken;
    const tokenExpiresAt = room.owner.tokenExpiresAt;

    // Refresh token if expired or expiring soon (within 5 minutes)
    if (
      tokenExpiresAt &&
      new Date() > new Date(Number(tokenExpiresAt) - 5 * 60 * 1000)
    ) {
      if (!room.owner.spotifyRefreshToken) {
        return NextResponse.json(
          { error: "No refresh token available for owner" },
          { status: 400 }
        );
      }

      const refreshedToken = await refreshSpotifyToken(
        room.owner.spotifyRefreshToken
      );
      if (!refreshedToken) {
        return NextResponse.json(
          { error: "Failed to refresh token" },
          { status: 500 }
        );
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
      return NextResponse.json(
        { error: "Invalid response from Spotify" },
        { status: 500 }
      );
    }

    const tracks = response.data.tracks.items.map((track: track) => ({
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

    return NextResponse.json({ tracks });
  } catch (error: any) {
    console.log("Error searching for songs:", error);
    return NextResponse.json(
      { error: error.response?.data?.error?.message || error.message },
      { status: 500 }
    );
  }
}
