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
type LeaveRoomCallback = (response: {
  error?: string;
  code?: string;
  message?: string;
}) => void;

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

const connectionCounts = new Map<string, number>();
const CONNECTION_LIMIT = 10;
const heartbeats = new Map<string, Date>();

(async () => {
  try {
    io.use(async (socket, next) => {
      const sessionUserData = socket.handshake.auth.session
        .user as SpotifyUserData;

      if (!sessionUserData.email) {
        console.warn("Unauthorized connection attempt");
        return next(new Error("Unauthorized"));
      }

      (socket.data as SocketData).user = sessionUserData;

      const count = connectionCounts.get(sessionUserData.userId) || 0;
      if (count >= CONNECTION_LIMIT) {
        return next(new Error("Rate limit exceeded"));
      }

      connectionCounts.set(sessionUserData.userId, count + 1);
      setTimeout(() => {
        connectionCounts.set(
          sessionUserData.userId,
          (connectionCounts.get(sessionUserData.userId) || 1) - 1
        );
      }, 60000);

      next();
    });

    io.on("connection", (socket) => {
      const user = (socket.data as SocketData).user;
      console.log(`User connected: ${user.name} (${user.userId})`);

      // Set initial heartbeat
      heartbeats.set(user.userId, new Date());

      // Add heartbeat handler
      socket.on("heartbeat", () => {
        heartbeats.set(user.userId, new Date());
      });

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

      socket.on(
        "leaveRoom",
        async (roomCode: string, callback: LeaveRoomCallback) => {
          try {
            const room = await prisma.room.findUnique({
              where: { roomCode },
              include: {
                participants: {
                  include: { user: { select: { id: true, name: true } } },
                },
              },
            });

            if (!room) {
              return callback({
                error: "Room not found",
                code: "ROOM_NOT_FOUND",
              });
            }

            const participant = room.participants.find(
              (p) => p.userId === user.userId
            );
            if (!participant) {
              return callback({
                error: "You are not in this room",
                code: "NOT_PARTICIPANT",
              });
            }

            const isOwner = room.ownerId === user.userId;

            if (isOwner) {
              // Owner is leaving - delete the entire room
              await prisma.$transaction([
                prisma.queueEntry.deleteMany({ where: { roomId: room.id } }),
                prisma.roomParticipant.deleteMany({
                  where: { roomId: room.id },
                }),
                prisma.room.delete({ where: { id: room.id } }),
              ]);

              io.to(roomCode).emit("roomClosed", {
                message: "Room closed by owner",
              });
              socket.leave(roomCode);

              return callback({
                message: "Room deleted and all participants removed",
              });
            }

            // Non-owner participant leaving
            await prisma.$transaction(async (tx) => {
              await tx.roomParticipant.delete({
                where: {
                  userId_roomId: { userId: user.userId, roomId: room.id },
                },
              });

              const updatedParticipants = await tx.roomParticipant.findMany({
                where: { roomId: room.id },
                include: { user: { select: { id: true, name: true } } },
              });

              socket.leave(roomCode);

              io.to(roomCode).emit("userLeft", {
                userId: user.userId,
                name: user.name,
              });

              const participantData = updatedParticipants.map((p) => ({
                id: p.user.id,
                name: p.user.name,
              }));

              io.to(roomCode).emit("participantsUpdated", participantData);
            });

            callback({ message: "You have left the room" });
          } catch (error) {
            console.error(
              `Error leaving room ${roomCode} for user ${user.userId}:`,
              error
            );
            callback({
              error: "Failed to leave room",
              code: "DATABASE_ERROR",
            });
          }
        }
      );

      setInterval(async () => {
        const now = new Date();
        for (const [userId, lastBeat] of heartbeats.entries()) {
          if (now.getTime() - lastBeat.getTime() > 2 * 60 * 1000) {
            // 2 minutes
            try {
              // User is inactive, clean up their room participations
              const userRooms = await prisma.roomParticipant.findMany({
                where: { userId },
                include: { room: true },
              });

              for (const participation of userRooms) {
                if (participation.room.ownerId === userId) {
                  // Owner is inactive - delete the entire room
                  await prisma.$transaction([
                    prisma.queueEntry.deleteMany({
                      where: { roomId: participation.roomId },
                    }),
                    prisma.roomParticipant.deleteMany({
                      where: { roomId: participation.roomId },
                    }),
                    prisma.room.delete({
                      where: { id: participation.roomId },
                    }),
                  ]);

                  io.to(participation.room.roomCode).emit("roomClosed", {
                    message: "Room closed due to owner inactivity",
                  });
                } else {
                  // Remove participant from room
                  await prisma.roomParticipant.delete({
                    where: {
                      userId_roomId: {
                        userId,
                        roomId: participation.roomId,
                      },
                    },
                  });

                  io.to(participation.room.roomCode).emit("userLeft", {
                    userId,
                    reason: "inactivity",
                  });
                }
              }

              heartbeats.delete(userId);
            } catch (error) {
              console.error(
                `Error cleaning up inactive user ${userId}:`,
                error
              );
            }
          }
        }
      }, 60000); // Check every minute
    });
  } catch (error) {
    console.error("Error setting up Socket.IO server:", error);
  }
})();
