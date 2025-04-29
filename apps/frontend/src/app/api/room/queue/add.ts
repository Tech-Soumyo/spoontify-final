import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";
import { io, Socket } from "socket.io-client";
import axios from "axios";
import refreshSpotifyToken from "@/hooks/refreshToaken";

// Create a singleton socket instance for reuse
export let socketInstance: Socket | null = null;

// Helper function to get or create socket connection
function getSocketInstance(): Socket {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      transports: ["websocket"],
      reconnection: true,
    });
  }
  return socketInstance;
}

process.on("SIGTERM", () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
});

async function fetchSpotifyTrack(
  trackId: string,
  accessToken: string,
  refreshToken: string,
  userId: string
) {
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      const newToken = await refreshSpotifyToken(refreshToken);
      if (newToken) {
        // Retry with new token
        const retryResponse = await axios.get(
          `https://api.spotify.com/v1/tracks/${trackId}`,
          {
            headers: {
              Authorization: `Bearer ${newToken.accessToken}`,
            },
          }
        );

        // Update session token in database
        await prisma.user.update({
          where: { id: userId },
          data: {
            spotifyAccessToken: newToken.accessToken,
            spotifyRefreshToken: newToken.refreshToken,
            tokenExpiresAt: new Date(newToken.accessTokenExpires),
          },
        });

        return retryResponse.data;
      }
    }
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { roomCode, track } = req.body;

  if (
    !roomCode ||
    !track ||
    !track.trackId ||
    !track.songName ||
    !track.artistName
  ) {
    return res.status(400).json({ error: "Missing roomCode or track data" });
  }

  try {
    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const spotifyTrack = await fetchSpotifyTrack(
      track.trackId,
      session.accessToken!,
      session.refreshToken!,
      session.user?.userId!
    );

    const duration_ms = spotifyTrack?.duration_ms ?? 0;

    // Use Prisma transaction and MAX aggregate to safely handle position
    const result = await prisma.$transaction(async (tx) => {
      // Get maximum position using aggregate
      const maxPosition = await tx.queueEntry.aggregate({
        where: { roomId: room.id },
        _max: { position: true },
      });

      const nextPosition = (maxPosition._max.position || -1) + 1;

      // Add track to QueueEntry
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

      // Fetch updated queue
      const updatedQueue = await tx.queueEntry.findMany({
        where: { roomId: room.id },
        orderBy: { position: "asc" },
      });

      return updatedQueue;
    });

    // Format queue for client with enhanced image handling
    const formattedQueue = result.map((entry) => ({
      id: entry.trackId,
      name: entry.songName,
      artists: Array.isArray(entry.artistName)
        ? entry.artistName.map((name) => ({ name }))
        : [{ name: entry.artistName as string }],
      album: {
        name: entry.albumName,
        imageUrl: entry.imageUrl,
        images: spotifyTrack.album.images || [], // Include all available album images
      },
      uri: `spotify:track:${entry.trackId}`,
      duration_ms: entry.durationMs,
      preview_url: spotifyTrack.preview_url || "",
      popularity: spotifyTrack.popularity || 0,
    }));

    // Get socket instance and emit event
    const socket = getSocketInstance();
    socket.emit("queueUpdated", { roomCode, queue: formattedQueue });

    // We don't disconnect the socket here - it's reused for future requests

    res.status(200).json({ queue: formattedQueue });
  } catch (error) {
    console.error("Add to queue error:", error);
    res.status(500).json({ error: "Failed to add song to queue" });
  }
}
