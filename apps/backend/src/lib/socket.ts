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

type SocketData = {
  user: SpotifyUserData;
};

export type track = {
  id: string;
  name: string;
  artists: { name: string }[];
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

export const io = new Server({
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
  perMessageDeflate: false,
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Heartbeat tracking for all connected users
const heartbeats = new Map<string, Date>();

// Track active rooms for easier reference
const activeRooms = new Set<string>();

// Start socket server
(async () => {
  try {
    // Middleware: Authenticate user and rate limit connections
    io.use(async (socket, next) => {
      try {
        const sessionUserData = socket.handshake.auth.session
          ?.user as SpotifyUserData;

        if (!sessionUserData?.email || !sessionUserData?.userId) {
          console.warn("Unauthorized connection attempt");
          return next(new Error("Unauthorized"));
        }

        // Store user data for later use
        (socket.data as SocketData).user = sessionUserData;

        next();
      } catch (error) {
        console.error("Authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });

    io.on("connection", (socket) => {
      const user = (socket.data as SocketData).user;
      const userId = user.userId;

      // Initialize heartbeat for this connection
      heartbeats.set(userId, new Date());

      // Handle heartbeat updates
      socket.on("heartbeat", () => {
        heartbeats.set(userId, new Date());
      });

      socket.on("createRoom", async (callback) => {
        try {
          // Update heartbeat when user interacts
          heartbeats.set(userId, new Date());

          const preUser = await prisma.user.findUnique({
            where: { id: userId },
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

          const roomCode = short.generate().slice(0, 6);

          const room = await prisma.room.create({
            data: {
              roomCode,
              ownerId: userId,
              participants: { create: [{ userId }] },
            },
          });

          // Add to active rooms tracking
          activeRooms.add(roomCode);

          socket.join(roomCode);
          console.log(`🔌 User connected: ${user.name} (${roomCode})`);
          callback({ roomCode, isOwner: true, ownerId: userId });
        } catch (error) {
          console.error("❌ Error creating room:", error);
          callback({ error: "Failed to create room", code: "DATABASE_ERROR" });
        }
      });

      socket.on("joinRoom", async (roomCode: string, callback) => {
        try {
          // Update heartbeat when user interacts
          heartbeats.set(userId, new Date());

          const room = await prisma.room.findUnique({ where: { roomCode } });

          if (!room) {
            return callback({
              error: "Room not found",
              code: "ROOM_NOT_FOUND",
            });
          }

          // Check if user is already in the room
          const existing = await prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId, roomId: room.id } },
          });

          // Only create new participant entry if not already in room
          if (!existing) {
            await prisma.roomParticipant.create({
              data: { userId, roomId: room.id },
            });
          }

          socket.join(roomCode);
          console.log(`🔌 User connected: ${user.name} (${roomCode})`);

          // Get all room participants
          const participants = await prisma.roomParticipant.findMany({
            where: { roomId: room.id },
            include: { user: { select: { id: true, name: true } } },
          });

          const participantData = participants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
          }));
          const messages = await prisma.chatMessage.findMany({
            where: { roomId: room.id },
            orderBy: { createdAt: "asc" },
            take: 50,
            include: { user: { select: { name: true } } },
          });

          socket.emit(
            "chatHistory",
            messages.map((msg) => ({
              id: msg.id,
              userId: msg.userId,
              userName: msg.user.name,
              content: msg.content,
              createdAt: msg.createdAt,
            }))
          );

          // Only notify of new user if they weren't already in the room
          if (!existing) {
            io.to(roomCode).emit("userJoined", { userId, name: user.name });
            io.to(roomCode).emit("participantsUpdated", participantData);
          }

          callback({
            participants: participantData,
            isOwner: room.ownerId === userId,
          });
        } catch (error) {
          console.error("❌ Error joining room:", error);
          callback({ error: "Failed to join room", code: "DATABASE_ERROR" });
        }
      });

      socket.on(
        "leaveRoom",
        async (roomCode: string, callback: LeaveRoomCallback) => {
          try {
            // Update heartbeat when user interacts
            heartbeats.set(userId, new Date());

            const room = await prisma.room.findUnique({
              where: { roomCode },
              include: {
                participants: {
                  include: {
                    user: true,
                  },
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
              (p) => p.userId === userId
            );
            if (!participant) {
              return callback({
                error: "You are not in this room",
                code: "NOT_PARTICIPANT",
              });
            }

            const isOwner = room.ownerId === userId;

            if (isOwner) {
              // Owner leaving, close the room
              await prisma.$transaction([
                prisma.chatMessage.deleteMany({
                  where: { roomId: room.id },
                }),
                prisma.queueEntry.deleteMany({ where: { roomId: room.id } }),
                prisma.roomParticipant.deleteMany({
                  where: { roomId: room.id },
                }),
                prisma.room.delete({ where: { id: room.id } }),
              ]);

              // Remove from active rooms
              activeRooms.delete(roomCode);

              io.to(roomCode).emit("roomClosed", {
                message: "Room closed by owner",
              });

              socket.leave(roomCode);

              return callback({
                message: "Room deleted and all participants removed",
              });
            }

            // Non-owner participant leaving
            await prisma.roomParticipant.delete({
              where: { userId_roomId: { userId, roomId: room.id } },
            });

            socket.leave(roomCode);

            // Get updated participants list
            const updatedParticipants = await prisma.roomParticipant.findMany({
              where: { roomId: room.id },
              include: { user: { select: { id: true, name: true } } },
            });

            const participantData = updatedParticipants.map((p) => ({
              id: p.user.id,
              name: p.user.name,
            }));

            // Notify room of user leaving
            io.to(roomCode).emit("userLeft", { userId, name: user.name });
            io.to(roomCode).emit("participantsUpdated", participantData);

            callback({ message: "You have left the room" });
          } catch (error) {
            console.error("❌ Error leaving room:", error);
            callback({ error: "Failed to leave room", code: "DATABASE_ERROR" });
          }
        }
      );

      socket.on("queueUpdated", ({ roomCode, queue }) => {
        io.to(roomCode).emit("queueUpdated", { queue });
      });

      socket.on(
        "sendMessage",
        async (data: { roomCode: string; message: string }, callback) => {
          try {
            const user = (socket.data as SocketData).user;
            const room = await prisma.room.findUnique({
              where: { roomCode: data.roomCode },
            });
            if (!room) {
              return callback({ error: "Room not found" });
            }

            const participant = await prisma.roomParticipant.findUnique({
              where: {
                userId_roomId: { userId: user.userId, roomId: room.id },
              },
            });
            if (!participant) {
              return callback({ error: "You are not in this room" });
            }

            if (!data.message.trim() || data.message.length > 500) {
              return callback({
                error:
                  "Invalid message: must be non-empty and under 500 characters",
              });
            }

            const chatMessage = await prisma.chatMessage.create({
              data: {
                roomId: room.id,
                userId: user.userId,
                content: data.message,
              },
            });

            io.to(data.roomCode).emit("newMessage", {
              id: chatMessage.id,
              userId: user.userId,
              userName: user.name,
              content: chatMessage.content,
              createdAt: chatMessage.createdAt,
            });

            callback({ success: true });
          } catch (error) {
            console.error("Error sending message:", error);
            callback({ error: "Failed to send message" });
          }
        }
      );

      socket.on(
        "playbackUpdate",
        ({ roomCode, currentTrack, isPlaying, playbackProgress }) => {
          socket.to(roomCode).emit("playbackUpdate", {
            currentTrack,
            isPlaying,
            playbackProgress,
          });
        }
      );

      socket.on("queueEmpty", ({ roomCode }) => {
        io.to(roomCode).emit("queueEmpty");
      });
    });

    console.log("🚀 Socket.IO server started successfully");
  } catch (error) {
    console.error("❌ Error setting up Socket.IO server:", error);
  }
})();
