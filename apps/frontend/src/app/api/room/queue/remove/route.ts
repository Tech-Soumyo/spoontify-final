import { NextResponse } from "next/server";
import { Prisma, prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roomCode, trackId } = body;

    if (!roomCode || !trackId) {
      return NextResponse.json(
        { error: "Missing roomCode or trackId" },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // First, get the entry we're about to delete to know its position
      const entryToDelete = await tx.queueEntry.findFirst({
        where: { roomId: room.id, trackId },
      });

      if (!entryToDelete) {
        // If entry doesn't exist, just return the current queue
        return await tx.queueEntry.findMany({
          where: { roomId: room.id },
          orderBy: { position: "asc" },
        });
      }

      // Delete the entry
      await tx.queueEntry.delete({
        where: { id: entryToDelete.id },
      });

      // Get all entries that had a higher position than the deleted one
      const entriesToUpdate = await tx.queueEntry.findMany({
        where: {
          roomId: room.id,
          position: { gt: entryToDelete.position },
        },
        orderBy: { position: "asc" },
      });

      // Update positions for affected entries (shift down by 1)
      for (const entry of entriesToUpdate) {
        await tx.queueEntry.update({
          where: { id: entry.id },
          data: { position: entry.position - 1 },
        });
      }

      // Return the updated queue
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
    console.log("Remove from queue error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(error);
      return NextResponse.json(
        { error: `Database error while removing song from queue ${error}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Failed to remove song from queue ${error}` },
      { status: 500 }
    );
  }
}
