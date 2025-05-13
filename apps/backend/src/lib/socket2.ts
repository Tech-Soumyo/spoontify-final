import { prisma } from "@repo/db";
import short from "short-uuid";
import { Server } from "socket.io";
import { createLogger } from "winston";
import { format, transports } from "winston";

// Configure production logging
const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log" }),
  ],
});

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
  preview_url: string;
  popularity: number;
  uri: string;
  duration_ms: number;
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

// Heartbeat tracking for all connected users
const heartbeats = new Map<string, Date>();

// Track active rooms and their heartbeats
const activeRooms = new Map<
  string,
  {
    heartbeatInterval: NodeJS.Timeout;
    lastHeartbeat: Date;
    participants: Set<string>;
  }
>();

// Cleanup function for room resources
const cleanupRoom = async (roomCode: string) => {
  const roomData = activeRooms.get(roomCode);
  if (roomData) {
    clearInterval(roomData.heartbeatInterval);
    activeRooms.delete(roomCode);
    logger.info(`Cleaned up room ${roomCode}`);
  }
};

// Start socket server
(async () => {
  try {
    // Middleware: Authenticate user and rate limit connections
    io.use(async (socket, next) => {
      try {
        const sessionUserData = socket.handshake.auth.session
          ?.user as SpotifyUserData;

        if (!sessionUserData?.email || !sessionUserData?.userId) {
          logger.warn("Unauthorized connection attempt", {
            socketId: socket.id,
          });
          return next(new Error("Unauthorized"));
        }

        (socket.data as SocketData).user = sessionUserData;
        next();
      } catch (error) {
        logger.error("Authentication error:", { error, socketId: socket.id });
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
          heartbeats.set(userId, new Date());

          const preUser = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!preUser) {
            logger.warn("User not found", { userId });
            return callback({
              error: "User not found",
              code: "USER_NOT_FOUND",
            });
          }

          if (!preUser.premium) {
            logger.warn("Non-premium user attempted to create room", {
              userId,
            });
            return callback({
              error: "Only premium users can create rooms",
              code: "USER_NOT_PREMIUM",
            });
          }

          const roomCode = short.generate().slice(0, 6);

          // Create room with transaction to ensure atomicity
          const room = await prisma.$transaction(async (tx) => {
            const newRoom = await tx.room.create({
              data: {
                roomCode,
                ownerId: userId,
                participants: { create: [{ userId }] },
              },
            });

            // Initialize room tracking
            activeRooms.set(roomCode, {
              heartbeatInterval: setInterval(() => {
                const roomData = activeRooms.get(roomCode);
                if (roomData) {
                  const now = new Date();
                  if (
                    now.getTime() - roomData.lastHeartbeat.getTime() >
                    60000
                  ) {
                    cleanupRoom(roomCode);
                  }
                }
              }, 30000),
              lastHeartbeat: new Date(),
              participants: new Set([userId]),
            });

            return newRoom;
          });

          socket.join(roomCode);
          logger.info(`Room created: ${roomCode}`, { userId, roomId: room.id });
          callback({ roomCode, isOwner: true, ownerId: userId });
        } catch (error) {
          logger.error("Error creating room:", { error, userId });
          callback({ error: "Failed to create room", code: "DATABASE_ERROR" });
        }
      });

      socket.on("joinRoom", async (roomCode: string, callback) => {
        try {
          heartbeats.set(userId, new Date());

          // Validate room code format
          if (!/^[A-Za-z0-9]{6}$/.test(roomCode)) {
            logger.warn("Invalid room code format", { roomCode });
            return callback({
              error: "Invalid room code format",
              code: "INVALID_ROOM_CODE",
            });
          }

          const room = await prisma.room.findUnique({ where: { roomCode } });

          if (!room) {
            logger.warn("Room not found", { roomCode });
            return callback({
              error: "Room not found",
              code: "ROOM_NOT_FOUND",
            });
          }

          // Check if user is already in the room
          const existing = await prisma.roomParticipant.findUnique({
            where: { userId_roomId: { userId, roomId: room.id } },
          });

          if (!existing) {
            await prisma.roomParticipant.create({
              data: { userId, roomId: room.id },
            });

            // Update room tracking
            const roomData = activeRooms.get(roomCode);
            if (roomData) {
              roomData.participants.add(userId);
              roomData.lastHeartbeat = new Date();
            }
          }

          socket.join(roomCode);
          logger.info(`User joined room: ${roomCode}`, { userId });

          const participants = await prisma.roomParticipant.findMany({
            where: { roomId: room.id },
            include: { user: { select: { id: true, name: true } } },
          });

          const participantData = participants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
          }));

          if (!existing) {
            io.to(roomCode).emit("userJoined", { userId, name: user.name });
            io.to(roomCode).emit("participantsUpdated", participantData);
          }

          callback({
            participants: participantData,
            isOwner: room.ownerId === userId,
          });
        } catch (error) {
          logger.error("Error joining room:", { error, userId, roomCode });
          callback({ error: "Failed to join room", code: "DATABASE_ERROR" });
        }
      });

      socket.on(
        "leaveRoom",
        async (roomCode: string, callback: LeaveRoomCallback) => {
          try {
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
              logger.warn("Room not found on leave", { roomCode });
              return callback({
                error: "Room not found",
                code: "ROOM_NOT_FOUND",
              });
            }

            const participant = room.participants.find(
              (p) => p.userId === userId
            );
            if (!participant) {
              logger.warn("User not in room", { userId, roomCode });
              return callback({
                error: "You are not in this room",
                code: "NOT_PARTICIPANT",
              });
            }

            const isOwner = room.ownerId === userId;

            if (isOwner) {
              // Clean up room resources
              await cleanupRoom(roomCode);

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
              logger.info(`Room closed by owner`, { roomCode, userId });

              return callback({
                message: "Room deleted and all participants removed",
              });
            }

            await prisma.roomParticipant.delete({
              where: { userId_roomId: { userId, roomId: room.id } },
            });

            socket.leave(roomCode);

            // Update room tracking
            const roomData = activeRooms.get(roomCode);
            if (roomData) {
              roomData.participants.delete(userId);
              roomData.lastHeartbeat = new Date();
            }

            const updatedParticipants = await prisma.roomParticipant.findMany({
              where: { roomId: room.id },
              include: { user: { select: { id: true, name: true } } },
            });

            const participantData = updatedParticipants.map((p) => ({
              id: p.user.id,
              name: p.user.name,
            }));

            io.to(roomCode).emit("userLeft", { userId, name: user.name });
            io.to(roomCode).emit("participantsUpdated", participantData);
            logger.info(`User left room`, { userId, roomCode });

            callback({ message: "You have left the room" });
          } catch (error) {
            logger.error("Error leaving room:", { error, userId, roomCode });
            callback({ error: "Failed to leave room", code: "DATABASE_ERROR" });
          }
        }
      );

      socket.on("disconnect", () => {
        logger.info("User disconnected", { userId });
        heartbeats.delete(userId);
      });
    });

    logger.info("Socket.IO server started successfully");
  } catch (error) {
    logger.error("Error setting up Socket.IO server:", error);
  }
})();

//  socket.on("addToQueue", async (roomCode: string, track: track, callback) => {
//    try {
//      // Update heartbeat when user interacts
//      heartbeats.set(userId, new Date());

//      if (!roomCode || !track || !track.id || !track.name || !track.artists) {
//        return callback({
//          error: "Invalid roomCode or track data",
//          code: "INVALID_INPUT",
//        });
//      }

//      // Fetch the room and its participants
//      const room = await prisma.room.findUnique({
//        where: { roomCode },
//        include: {
//          participants: true,
//          owner: true,
//        },
//      });

//      if (!room) {
//        return callback({
//          error: "Room not found",
//          code: "ROOM_NOT_FOUND",
//        });
//      }

//      // Check if the user is a participant in the room
//      const isParticipant = room.participants.some((p) => p.userId === userId);
//      if (!isParticipant) {
//        return callback({
//          error: "You are not a participant in this room",
//          code: "NOT_PARTICIPANT",
//        });
//      }

//      // Get the highest position in the queue
//      const highestPosition = await prisma.queueEntry.findFirst({
//        where: { roomId: room.id },
//        orderBy: { position: "desc" },
//        select: { position: true },
//      });

//      const nextPosition = highestPosition ? highestPosition.position + 1 : 0;

//      // Add the track to the queue
//      await prisma.queueEntry.create({
//        data: {
//          roomId: room.id,
//          trackId: track.id,
//          songName: track.name,
//          artistName: track.artists.map((artist) => artist.name), // Ensure it's an array of strings
//          albumName: track.album.name,
//          imageUrl: track.album.imageUrl,
//          position: nextPosition,
//          addedById: userId,
//        },
//      });

//      // Fetch the updated queue
//      const updatedQueue = await prisma.queueEntry.findMany({
//        where: { roomId: room.id },
//        orderBy: { position: "asc" },
//        include: { addedBy: { select: { id: true, name: true } } },
//      });

//      // Format the queue for the frontend
//      const formattedQueue = updatedQueue.map((entry) => ({
//        id: entry.id,
//        trackId: entry.trackId,
//        songName: entry.songName,
//        artistName: entry.artistName,
//        albumName: entry.albumName,
//        imageUrl: entry.imageUrl,
//        addedById: entry.addedById,
//        addedByName: entry.addedBy?.name || "Unknown",
//        position: entry.position,
//      }));

//      // Emit the updated queue to all participants in the room
//      io.to(roomCode).emit("queueUpdated", formattedQueue);

//      // Notify the user of success
//      callback({ message: "Track added to queue" });
//    } catch (error) {
//      console.error("❌ Error adding track to queue:", error);
//      callback({
//        error: "Failed to add track to queue",
//        code: "DATABASE_ERROR",
//      });
//    }
//  });
