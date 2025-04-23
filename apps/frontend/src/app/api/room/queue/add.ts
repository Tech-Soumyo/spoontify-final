import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";
import { io, Socket } from "socket.io-client";

// Create a singleton socket instance for reuse
let socketInstance: Socket | null = null;

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

  if (!roomCode || !track) {
    return res.status(400).json({ error: "Missing roomCode or track data" });
  }

  try {
    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

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
        },
      });

      // Fetch updated queue
      const updatedQueue = await tx.queueEntry.findMany({
        where: { roomId: room.id },
        orderBy: { position: "asc" },
      });

      return updatedQueue;
    });

    // Format queue for client
    const formattedQueue = result.map((entry) => ({
      id: entry.trackId,
      name: entry.songName,
      artists: Array.isArray(entry.artistName)
        ? entry.artistName.map((name) => ({ name }))
        : [{ name: entry.artistName as string }],
      album: { name: entry.albumName, imageUrl: entry.imageUrl, images: [] },
      uri: `spotify:track:${entry.trackId}`,
      duration_ms: 0, // Placeholder; fetch from Spotify if needed
      preview_url: "",
      popularity: 0,
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
