import { prisma } from "@repo/db";
import short from "short-uuid";
import { Server } from "socket.io";

type SpotifyUserData = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  spotifyId?: string | null;
  spotifyName?: string | null;
  spotifyEmail?: string | null;
  isPremium?: boolean;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
};

const io = new Server({
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
  perMessageDeflate: false,
  pingInterval: 25000,
  pingTimeout: 60000,
});

type SocketData = {
  user: SpotifyUserData;
};

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
  preview_url: string | null;
  popularity: number;
  uri: string;
  duration: number;
};

interface RoomData {
  ownerId: string;
  ownerName: string;
  ownerAccessToken?: string;
  participants: string[];
  queue: any[];
  currentTrack: track | null;
  isPlaying: boolean;
}

(async () => {
  try {
    io.use(async (socket, next) => {
      const sessionUserData = socket.handshake.auth.user as SpotifyUserData;

      if (!sessionUserData.email) {
        console.warn("Unauthorized connection attempt");
        return next(new Error("Unauthorized"));
      }

      (socket.data as SocketData).user = sessionUserData;
      next();
    });

    io.on("connection", (socket) => {
      const user = (socket.data as SocketData).user;
      console.log(`User connected: ${user.name} (${user.userId})`);

      socket.on("createRoom", async (callback) => {
        try {
          const preUser = await prisma.user.findUnique({
            where: { id: user.userId },
          });
          if (!preUser) {
            return callback({
              error: "User not found",
              code: "USER_NOT_FOUND",
            });
          }
          if (!preUser.premium) {
            return callback({
              error: "Only premium users can create rooms",
              code: "USER_NOT_PREMIUM",
            });
          }

          const roomCode = short.generate();
          const room = await prisma.room.create({
            data: {
              roomCode,
              ownerId: user.userId,
              participants: { create: [{ userId: user.userId }] },
            },
          });

          socket.join(roomCode);
          callback({ roomCode, isOwner: true, ownerId: room.ownerId });
        } catch (error) {
          console.error(`Error creating room for user ${user.userId}:`, error);
          callback({ error: "Failed to create room", code: "DATABASE_ERROR" });
        }
      });

      socket.on("joinRoom", async (roomCode: string, callback) => {
        try {
          const room = await prisma.room.findUnique({ where: { roomCode } });
          if (!room) {
            return callback({
              error: "Room not found",
              code: "ROOM_NOT_FOUND",
            });
          }

          const participants = await prisma.roomParticipant.findMany({
            where: { roomId: room.id },
            include: { user: { select: { id: true, name: true } } },
          });
          const participantData = participants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
          }));

          const existingParticipant = await prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId: user.userId, roomId: room.id } },
          });
          if (existingParticipant) {
            socket.join(roomCode);
            return callback({
              participants: participantData,
              isOwner: room.ownerId === user.userId,
            });
          }

          await prisma.roomParticipant.create({
            data: { userId: user.userId, roomId: room.id },
          });

          socket.join(roomCode);
          io.to(roomCode).emit("userJoined", {
            userId: user.userId,
            name: user.name,
          });

          // Refresh participant data after adding new user
          const updatedParticipants = await prisma.roomParticipant.findMany({
            where: { roomId: room.id },
            include: { user: { select: { id: true, name: true } } },
          });
          const updatedParticipantData = updatedParticipants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
          }));
          io.to(roomCode).emit("participantsUpdated", updatedParticipantData);

          callback({
            participants: updatedParticipantData,
            isOwner: room.ownerId === user.userId,
          });
        } catch (error) {
          console.error(
            `Error joining room ${roomCode} for user ${user.userId}:`,
            error
          );
          callback({ error: "Failed to join room", code: "DATABASE_ERROR" });
        }
      });

      socket.on("leaveRoom", async (roomCode: string, callback) => {
        try {
          const room = await prisma.room.findUnique({ where: { roomCode } });
          if (!room) {
            return callback({
              error: "Room not found",
              code: "ROOM_NOT_FOUND",
            });
          }

          const participant = await prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId: user.userId, roomId: room.id } },
          });
          if (!participant) {
            return callback({
              error: "You are not in this room",
              code: "NOT_PARTICIPANT",
            });
          }

          const isOwner = room.ownerId === user.userId;
          if (isOwner) {
            await prisma.$transaction([
              prisma.queueEntry.deleteMany({ where: { roomId: room.id } }),
              prisma.roomParticipant.deleteMany({ where: { roomId: room.id } }),
              prisma.room.delete({ where: { id: room.id } }),
            ]);

            io.to(roomCode).emit("roomClosed", {
              message: "Room closed by owner",
            });
            socket.leave(roomCode);
            callback({ message: "Room deleted and all participants removed" });
          } else {
            await prisma.roomParticipant.delete({
              where: {
                userId_roomId: { userId: user.userId, roomId: room.id },
              },
            });

            socket.leave(roomCode);

            io.to(roomCode).emit("userLeft", {
              userId: user.userId,
              name: user.name,
            });

            const updatedParticipants = await prisma.roomParticipant.findMany({
              where: { roomId: room.id },
              include: { user: { select: { id: true, name: true } } },
            });

            const participantData = updatedParticipants.map((p) => ({
              id: p.user.id,
              name: p.user.name,
            }));

            io.to(roomCode).emit("participantsUpdated", participantData);

            callback({ message: "You have left the room" });
          }
        } catch (error) {
          console.error(
            `Error leaving room ${roomCode} for user ${user.userId}:`,
            error
          );
          callback({ error: "Failed to leave room", code: "DATABASE_ERROR" });
        }
      });
    });
  } catch (error) {
    console.error("Error setting up Socket.IO server:", error);
  }
})();
