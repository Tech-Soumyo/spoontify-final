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

type ServerToClientEvents = {
  userJoined: (data: { userId: string; name: string }) => void;
  userLeft: (data: { userId: string; name: string; reason?: string }) => void;
  participantsUpdated: (participants: { id: string; name: string }[]) => void;
  roomClosed: (data: { message: string }) => void;
};

type ClientToServerEvents = {
  createRoom: (
    callback: (response: {
      error?: string;
      code?: string;
      roomCode?: string;
      isOwner?: boolean;
      ownerId?: string;
    }) => void
  ) => void;
  joinRoom: (
    roomCode: string,
    callback: (response: {
      error?: string;
      code?: string;
      participants?: { id: string; name: string }[];
      isOwner?: boolean;
    }) => void
  ) => void;
  leaveRoom: (roomCode: string, callback: LeaveRoomCallback) => void;
  heartbeat: () => void;
};

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

export const io = new Server<ClientToServerEvents, ServerToClientEvents>({
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
  perMessageDeflate: false,
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Connection tracking with rate limiting
const connectionCounts = new Map<string, number>();
const CONNECTION_LIMIT = 10;

// Heartbeat tracking for all connected users
const heartbeats = new Map<string, Date>();

// Single global cleanup interval rather than per-connection
let cleanupIntervalId: NodeJS.Timeout | null = null;

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

        // Rate limiting
        const userId = sessionUserData.userId;
        const count = connectionCounts.get(userId) || 0;

        if (count >= CONNECTION_LIMIT) {
          console.warn(`Rate limit exceeded for user ${userId}`);
          return next(new Error("Rate limit exceeded"));
        }

        connectionCounts.set(userId, count + 1);

        // Store user data for later use
        (socket.data as SocketData).user = sessionUserData;

        next();
      } catch (error) {
        console.error("Authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });

    // Create a single cleanup interval for the entire server
    if (!cleanupIntervalId) {
      cleanupIntervalId = setInterval(
        async () => {
          const now = new Date();
          const inactivityThreshold = 3 * 60 * 1000; // 3 minutes

          // Get a snapshot of the current heartbeats to avoid mutation during iteration
          const currentHeartbeats = new Map(heartbeats);

          for (const [uid, lastBeat] of currentHeartbeats.entries()) {
            if (now.getTime() - lastBeat.getTime() > inactivityThreshold) {
              try {
                await cleanupUser(uid, "inactivity");
                // Remove from heartbeats map after cleanup is complete
                heartbeats.delete(uid);
              } catch (err) {
                console.error(
                  `❌ Error cleaning up inactive user ${uid}:`,
                  err
                );
              }
            }
          }
        },
        3 * 60 * 1000
      ); // Run every 3 minutes
    }

    // Helper function to clean up user resources
    async function cleanupUser(userId: string, reason: string) {
      const userRooms = await prisma.roomParticipant.findMany({
        where: { userId },
        include: {
          room: true,
          user: true,
        },
      });

      for (const participation of userRooms) {
        const roomCode = participation.room.roomCode;

        // If owner, close the entire room
        if (participation.room.ownerId === userId) {
          await prisma.$transaction([
            prisma.queueEntry.deleteMany({
              where: { roomId: participation.roomId },
            }),
            prisma.roomParticipant.deleteMany({
              where: { roomId: participation.roomId },
            }),
            prisma.room.delete({ where: { id: participation.roomId } }),
          ]);

          io.to(roomCode).emit("roomClosed", {
            message: `Room closed due to owner ${reason}`,
          });

          // Remove from active rooms tracking
          activeRooms.delete(roomCode);
        } else {
          // Just remove the participant
          await prisma.roomParticipant.delete({
            where: { userId_roomId: { userId, roomId: participation.roomId } },
          });

          // Get updated participants
          const updatedParticipants = await prisma.roomParticipant.findMany({
            where: { roomId: participation.roomId },
            include: { user: { select: { id: true, name: true } } },
          });

          const participantData = updatedParticipants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
          }));

          // Notify room of participant leaving and update participant list
          io.to(roomCode).emit("userLeft", {
            userId,
            name: participation.user.name,
            reason,
          });

          io.to(roomCode).emit("participantsUpdated", participantData);
        }
      }
    }

    io.on("connection", (socket) => {
      const user = (socket.data as SocketData).user;
      const userId = user.userId;
      // console.log(`🔌 User connected: ${user.name} (${userId})`);

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
    });

    // Clean up the interval when the process exits
    process.on("SIGINT", () => {
      if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
      }
      process.exit(0);
    });

    console.log("🚀 Socket.IO server started successfully");
  } catch (error) {
    console.error("❌ Error setting up Socket.IO server:", error);
  }
})();
