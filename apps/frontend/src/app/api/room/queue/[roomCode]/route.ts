import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> | { roomCode: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params if it's a Promise
    const resolvedParams = await Promise.resolve(params);
    const { roomCode } = resolvedParams;

    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
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
        images: entry.imageUrl ? [{ url: entry.imageUrl }] : [],
      },
      uri: `spotify:track:${entry.trackId}`,
      duration_ms: entry.durationMs || 0,
      preview_url: "",
      popularity: 0,
    }));

    return NextResponse.json({ queue: formattedQueue });
  } catch (error) {
    console.error("Fetch queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}
