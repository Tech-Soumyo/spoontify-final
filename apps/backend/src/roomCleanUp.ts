import { CronJob } from "cron";
import { prisma } from "@repo/db";

// Add a simple logger (or use your preferred logging library)
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

const cleanupStaleRooms = async () => {
  const staleDate = new Date();
  staleDate.setHours(staleDate.getHours() - 24);

  const staleRooms = await prisma.room.findMany({
    where: {
      createdAt: {
        // Changed from updatedAt to createdAt
        lt: staleDate,
      },
    },
  });

  for (const room of staleRooms) {
    try {
      await prisma.$transaction([
        prisma.queueEntry.deleteMany({ where: { roomId: room.id } }),
        prisma.roomParticipant.deleteMany({ where: { roomId: room.id } }),
        prisma.room.delete({ where: { id: room.id } }),
      ]);

      logger.info(`Cleaned up stale room: ${room.roomCode}`);
    } catch (error) {
      logger.error(`Failed to clean up room ${room.roomCode}: ${error}`);
    }
  }
};

// Run every day at midnight
const job = new CronJob("0 0 * * *", cleanupStaleRooms);
job.start();
