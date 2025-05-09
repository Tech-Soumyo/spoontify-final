import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";
import axios from "axios";
import refreshSpotifyToken from "@/hooks/refreshToaken";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roomCode, track } = body;

    if (
      !roomCode ||
      !track ||
      !track.trackId ||
      !track.songName ||
      !track.artistName
    ) {
      return NextResponse.json(
        { error: "Missing roomCode or track data" },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    let duration_ms = 0;
    try {
      const spotifyRes = await axios.get(
        `https://api.spotify.com/v1/tracks/${track.trackId}`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }
      );
      duration_ms = spotifyRes.data?.duration_ms ?? 0;
    } catch (error: any) {
      if (error.response?.status === 401) {
        const newToken = await refreshSpotifyToken(session.refreshToken!);
        if (newToken) {
          await prisma.user.update({
            where: { id: session.user?.userId },
            data: {
              spotifyAccessToken: newToken.accessToken,
              spotifyRefreshToken: newToken.refreshToken,
              tokenExpiresAt: new Date(newToken.accessTokenExpires),
            },
          });
          const retryRes = await axios.get(
            `https://api.spotify.com/v1/tracks/${track.trackId}`,
            {
              headers: { Authorization: `Bearer ${newToken.accessToken}` },
            }
          );
          duration_ms = retryRes.data?.duration_ms ?? 0;
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find all existing entries for this room to determine next position
      const existingEntries = await tx.queueEntry.findMany({
        where: { roomId: room.id },
        orderBy: { position: "desc" },
        take: 1,
      });

      // If there are existing entries, use the highest position + 1
      // Otherwise, start at position 0
      const nextPosition =
        existingEntries.length > 0 && existingEntries[0]
          ? existingEntries[0].position + 1
          : 0;

      // Create the new queue entry
      await tx.queueEntry.create({
        data: {
          roomId: room.id,
          trackId: track.trackId,
          songName: track.songName,
          artistName: track.artistName,
          albumName: track.albumName,
          imageUrl: track.imageUrl,
          addedById: session.user?.userId!,
          position: nextPosition,
          durationMs: duration_ms,
        },
      });

      // Return all queue entries for this room
      return await tx.queueEntry.findMany({
        where: { roomId: room.id },
        orderBy: { position: "asc" },
      });
    });

    const formattedQueue = result.map((entry) => ({
      id: entry.trackId,
      name: entry.songName,
      artists: Array.isArray(entry.artistName)
        ? (entry.artistName as string[]).map((name: string) => ({ name }))
        : [{ name: entry.artistName as string }],
      album: {
        name: entry.albumName,
        imageUrl: entry.imageUrl || "",
        images: entry.imageUrl ? [{ url: entry.imageUrl }] : [],
      },
      uri: `spotify:track:${entry.trackId}`,
      duration_ms: entry.durationMs || 0,
      preview_url: "",
      popularity: 0,
    })); // Return the updated queue - socket events will be handled by the client
    return NextResponse.json({ queue: formattedQueue }, { status: 200 });
  } catch (error) {
    console.log("Add to queue error:", error);
    return NextResponse.json(
      { error: "Failed to add song to queue" },
      { status: 500 }
    );
  }
}
