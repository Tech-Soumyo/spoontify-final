import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { roomCode } = req.query;

  if (!roomCode || typeof roomCode !== "string") {
    return res.status(400).json({ error: "Missing or invalid roomCode" });
  }

  try {
    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const queue = await prisma.queueEntry.findMany({
      where: { roomId: room.id },
      orderBy: { position: "asc" },
    });

    const formattedQueue = queue.map((entry) => ({
      id: entry.trackId,
      name: entry.songName,
      artists: Array.isArray(entry.artistName)
        ? entry.artistName.map((name) => ({ name }))
        : [{ name: entry.artistName as string }],
      album: {
        name: entry.albumName,
        imageUrl: entry.imageUrl || "",
        images: [],
      },
      uri: `spotify:track:${entry.trackId}`,
      duration_ms: 0,
      preview_url: "", // Changed from null to empty string
      popularity: 0,
    }));

    res.status(200).json({ queue: formattedQueue });
  } catch (error) {
    console.error("Fetch queue error:", error);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
}
