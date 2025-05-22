import { prisma } from "@repo/db";
import axios from "axios";
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
              imageUrl: msg.imageUrl,
              createdAt: msg.createdAt,
            }))
          );

          const polls = await prisma.poll.findMany({
            where: { roomId: room.id },
            include: {
              createdBy: { select: { name: true } },
              votes: {
                include: {
                  user: { select: { name: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
            take: 5, // Limit to prevent performance issues
          });

          const formattedPolls = polls.map((poll) => ({
            id: poll.id,
            trackId: poll.trackId,
            songName: poll.songName,
            artistName: poll.artistName,
            albumName: poll.albumName,
            imageUrl: poll.imageUrl,
            createdById: poll.createdById,
            createdByName: poll.createdBy.name,
            createdAt: poll.createdAt.toISOString(),
            closed: poll.closed,
            votes: poll.votes.map((vote) => ({
              userId: vote.userId,
              userName: vote.user.name,
              vote: vote.vote,
              createdAt: vote.createdAt.toISOString(),
            })),
          }));

          socket.emit("pollHistory", formattedPolls);

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
                prisma.pollVote.deleteMany({
                  where: { poll: { roomId: room.id } },
                }),
                prisma.poll.deleteMany({
                  where: { roomId: room.id },
                }),
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
        async (
          data: { roomCode: string; message?: string; imageUrl?: string },
          callback
        ) => {
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

            // Validate message or image
            if (
              (!data.message || data.message.trim() === "") &&
              (!data.imageUrl || data.imageUrl.trim() === "")
            ) {
              return callback({
                error: "Message or image must be provided",
              });
            }
            if (data.message && data.message.length > 500) {
              return callback({
                error: "Message must be under 500 characters",
              });
            }

            const chatMessage = await prisma.chatMessage.create({
              data: {
                roomId: room.id,
                userId: user.userId,
                content: data.message || null,
                imageUrl: data.imageUrl || null,
              },
            });

            io.to(data.roomCode).emit("newMessage", {
              id: chatMessage.id,
              userId: user.userId,
              userName: user.name,
              content: chatMessage.content,
              imageUrl: chatMessage.imageUrl,
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
      // In socket.ts, inside io.on("connection", (socket) => {...})
      socket.on(
        "createPoll",
        async (
          data: {
            roomCode: string;
            track: {
              trackId: string;
              songName: string;
              artistName: string | string[];
              albumName: string;
              imageUrl: string;
            };
          },
          callback
        ) => {
          try {
            const user = (socket.data as SocketData).user;
            const room = await prisma.room.findUnique({
              where: { roomCode: data.roomCode },
            });
            if (!room) {
              return callback({
                error: "Room not found",
                code: "ROOM_NOT_FOUND",
              });
            }

            const participant = await prisma.roomParticipant.findUnique({
              where: {
                userId_roomId: { userId: user.userId, roomId: room.id },
              },
            });
            if (!participant) {
              return callback({
                error: "You are not in this room",
                code: "NOT_PARTICIPANT",
              });
            }

            // Check if a poll for this track already exists and is open
            const existingPoll = await prisma.poll.findFirst({
              where: {
                roomId: room.id,
                trackId: data.track.trackId,
                closed: false,
              },
            });
            if (existingPoll) {
              return callback({
                error: "A poll for this song is already active",
                code: "POLL_EXISTS",
              });
            }

            const poll = await prisma.poll.create({
              data: {
                roomId: room.id,
                trackId: data.track.trackId,
                songName: data.track.songName,
                artistName: Array.isArray(data.track.artistName)
                  ? data.track.artistName
                  : [data.track.artistName],
                albumName: data.track.albumName,
                imageUrl: data.track.imageUrl,
                createdById: user.userId,
              },
            });

            io.to(data.roomCode).emit("pollCreated", {
              id: poll.id,
              trackId: poll.trackId,
              songName: poll.songName,
              artistName: poll.artistName,
              albumName: poll.albumName,
              imageUrl: poll.imageUrl,
              createdById: poll.createdById,
              createdByName: user.name,
              createdAt: poll.createdAt,
              closed: poll.closed,
              votes: [],
            });

            callback({ success: true, pollId: poll.id });
          } catch (error) {
            console.error("Error creating poll:", error);
            callback({
              error: "Failed to create poll",
              code: "DATABASE_ERROR",
            });
          }
        }
      );

      socket.on(
        "votePoll",
        async (
          data: { roomCode: string; pollId: string; vote: boolean },
          callback
        ) => {
          try {
            const user = (socket.data as SocketData).user;
            const room = await prisma.room.findUnique({
              where: { roomCode: data.roomCode },
            });
            if (!room) {
              return callback({
                error: "Room not found",
                code: "ROOM_NOT_FOUND",
              });
            }

            const poll = await prisma.poll.findUnique({
              where: { id: data.pollId },
              include: { votes: true },
            });
            if (!poll || poll.closed) {
              return callback({
                error: "Poll not found or already closed",
                code: "POLL_INVALID",
              });
            }

            const participant = await prisma.roomParticipant.findUnique({
              where: {
                userId_roomId: { userId: user.userId, roomId: room.id },
              },
            });
            if (!participant) {
              return callback({
                error: "You are not in this room",
                code: "NOT_PARTICIPANT",
              });
            }

            // Check if user already voted
            const existingVote = await prisma.pollVote.findUnique({
              where: {
                pollId_userId: { pollId: data.pollId, userId: user.userId },
              },
            });
            if (existingVote) {
              return callback({
                error: "You have already voted",
                code: "ALREADY_VOTED",
              });
            }

            const vote = await prisma.pollVote.create({
              data: {
                pollId: data.pollId,
                userId: user.userId,
                vote: data.vote,
              },
            });

            const updatedVotes = await prisma.pollVote.findMany({
              where: { pollId: data.pollId },
              include: { user: { select: { name: true } } },
            });

            io.to(data.roomCode).emit("pollUpdated", {
              pollId: data.pollId,
              votes: updatedVotes.map((v) => ({
                userId: v.userId,
                userName: v.user.name,
                vote: v.vote,
                createdAt: v.createdAt,
              })),
            });

            callback({ success: true });
          } catch (error) {
            console.error("Error voting on poll:", error);
            callback({ error: "Failed to vote", code: "DATABASE_ERROR" });
          }
        }
      );

      socket.on(
        "closePoll",
        async (data: { roomCode: string; pollId: string }, callback) => {
          try {
            const user = (socket.data as SocketData).user;
            const room = await prisma.room.findUnique({
              where: { roomCode: data.roomCode },
            });
            if (!room) {
              return callback({
                error: "Room not found",
                code: "ROOM_NOT_FOUND",
              });
            }

            const poll = await prisma.poll.findUnique({
              where: { id: data.pollId },
              include: { votes: true },
            });
            if (!poll || poll.closed) {
              return callback({
                error: "Poll not found or already closed",
                code: "POLL_INVALID",
              });
            }

            if (poll.createdById !== user.userId) {
              return callback({
                error: "Only the poll creator can close it",
                code: "UNAUTHORIZED",
              });
            }

            await prisma.poll.update({
              where: { id: data.pollId },
              data: { closed: true },
            });

            // Calculate vote percentage
            const totalVotes = poll.votes.length;
            const yesVotes = poll.votes.filter((v) => v.vote).length;
            const yesPercentage =
              totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;

            // If yes votes >= 50%, add song to queue
            if (yesPercentage >= 50) {
              const existingEntries = await prisma.queueEntry.findMany({
                where: { roomId: room.id },
                orderBy: { position: "desc" },
                take: 1,
              });

              const nextPosition =
                existingEntries.length > 0 && existingEntries[0]
                  ? existingEntries[0].position + 1
                  : 0;

              let duration_ms = 0;
              try {
                const spotifyRes = await axios.get(
                  `https://api.spotify.com/v1/tracks/${poll.trackId}`,
                  {
                    headers: {
                      Authorization: `Bearer ${user.spotifyAccessToken}`,
                    },
                  }
                );
                duration_ms = spotifyRes.data?.duration_ms ?? 0;
              } catch (error: any) {
                console.error("Error fetching track duration:", error);
              }

              await prisma.queueEntry.create({
                data: {
                  roomId: room.id,
                  trackId: poll.trackId,
                  songName: poll.songName,
                  artistName: poll.artistName!,
                  albumName: poll.albumName,
                  imageUrl: poll.imageUrl,
                  addedById: user.userId,
                  position: nextPosition,
                  durationMs: duration_ms,
                },
              });

              const updatedQueue = await prisma.queueEntry.findMany({
                where: { roomId: room.id },
                orderBy: { position: "asc" },
              });

              const formattedQueue = updatedQueue.map((entry) => ({
                id: entry.trackId,
                name: entry.songName,
                artists: Array.isArray(entry.artistName)
                  ? entry.artistName.map((name) => ({
                      name: typeof name === "string" ? name : "",
                    }))
                  : [
                      {
                        name:
                          typeof entry.artistName === "string"
                            ? entry.artistName
                            : "",
                      },
                    ],
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

              io.to(data.roomCode).emit("queueUpdated", {
                queue: formattedQueue,
              });
            }

            io.to(data.roomCode).emit("pollClosed", {
              pollId: data.pollId,
              yesPercentage,
              addedToQueue: yesPercentage >= 50,
            });

            callback({
              success: true,
              yesPercentage,
              addedToQueue: yesPercentage >= 50,
            });
          } catch (error) {
            console.error("Error closing poll:", error);
            callback({ error: "Failed to close poll", code: "DATABASE_ERROR" });
          }
        }
      );
    });

    console.log("🚀 Socket.IO server started successfully");
  } catch (error) {
    console.error("❌ Error setting up Socket.IO server:", error);
  }
})();
