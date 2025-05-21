"use client";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type SocketResponse = {
  error?: string;
  code?: string;
  roomCode?: string;
  participants?: { id: string; name: string }[];
  isOwner?: boolean;
  message?: string;
};

export type Poll = {
  id: string;
  trackId: string;
  songName: string;
  artistName: string | string[];
  albumName: string;
  imageUrl: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  closed: boolean;
  votes: {
    userId: string;
    userName: string;
    vote: boolean;
    createdAt: string;
  }[];
};

export const useSocket = (roomCode?: string) => {
  const { data: session } = useSession();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    if (session?.user?.userId) {
      setIsSessionReady(true);
    }
  }, [session]);

  useEffect(() => {
    if (
      !isSessionReady ||
      (socketRef.current && socketRef.current.connected) ||
      !session
    )
      return;

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
      auth: {
        session: {
          user: {
            ...(session?.user || {}),
            spotifyAccessToken: session?.accessToken,
            spotifyRefreshToken: session?.refreshToken,
          },
        },
      },
      reconnection: true,
      transports: ["websocket"],
    });

    socketRef.current = socketInstance;

    const heartbeatInterval = setInterval(() => {
      socketInstance.emit("heartbeat");
    }, 30000);

    const handleUserJoined = ({
      userId,
      name,
    }: {
      userId: string;
      name: string;
    }) => {
      setConnectedUsers((prev) =>
        prev.some((u) => u.id === userId)
          ? prev
          : [...prev, { id: userId, name }]
      );
    };

    const handleRoomClosed = () => {
      toast.info("Room has been closed");
      router.push("/createjoin");
    };

    const handleUserLeft = ({
      userId,
      name,
    }: {
      userId: string;
      name: string;
    }) => {
      toast.info(`${name} left the room`);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== userId));
    };

    const handleParticipantsUpdated = (
      participants: { id: string; name: string }[]
    ) => {
      console.log("Received participantsUpdated:", participants);
      setConnectedUsers(participants);
    };

    const handlePollCreated = (poll: Poll) => {
      setPolls((prev) => [...prev, poll]);
    };

    const handlePollUpdated = (data: {
      pollId: string;
      votes: {
        userId: string;
        userName: string;
        vote: boolean;
        createdAt: string;
      }[];
    }) => {
      setPolls((prev) =>
        prev.map((poll) =>
          poll.id === data.pollId ? { ...poll, votes: data.votes } : poll
        )
      );
    };

    const handlePollClosed = (data: {
      pollId: string;
      yesPercentage: number;
      addedToQueue: boolean;
    }) => {
      setPolls((prev) =>
        prev.map((poll) =>
          poll.id === data.pollId ? { ...poll, closed: true } : poll
        )
      );
      toast.info(
        data.addedToQueue
          ? `Poll closed: Song added to queue (${data.yesPercentage.toFixed(1)}% Yes)`
          : `Poll closed: Song not added (${data.yesPercentage.toFixed(1)}% Yes)`
      );
    };

    const handlePollHistory = (polls: Poll[]) => {
      setPolls(polls);
    };

    socketInstance.on("connect", () => console.log("Socket connected"));
    socketInstance.on("userJoined", handleUserJoined);
    socketInstance.on("participantsUpdated", handleParticipantsUpdated);
    socketInstance.on("roomClosed", handleRoomClosed);
    socketInstance.on("userLeft", handleUserLeft);
    socketInstance.on("pollCreated", handlePollCreated);
    socketInstance.on("pollUpdated", handlePollUpdated);
    socketInstance.on("pollClosed", handlePollClosed);
    socketInstance.on("pollHistory", handlePollHistory);

    if (roomCode) {
      socketInstance.emit("joinRoom", roomCode, (response: SocketResponse) => {
        if (response.error) {
          console.log("Join room error:", response.error);
          setError(response.error);
        } else {
          setConnectedUsers(response.participants || []);
          setIsOwner(response.isOwner || false);
        }
      });
    }

    return () => {
      clearInterval(heartbeatInterval);
      socketInstance.off("connect");
      socketInstance.off("userJoined", handleUserJoined);
      socketInstance.off("participantsUpdated", handleParticipantsUpdated);
      socketInstance.off("roomClosed", handleRoomClosed);
      socketInstance.off("userLeft", handleUserLeft);
      socketInstance.off("pollCreated", handlePollCreated);
      socketInstance.off("pollUpdated", handlePollUpdated);
      socketInstance.off("pollClosed", handlePollClosed);
      socketInstance.off("pollHistory", handlePollHistory);
      socketInstance.disconnect();
    };
  }, [isSessionReady, session, roomCode, router]);

  useEffect(() => {
    console.log("Updated connectedUsers in useSocket:", connectedUsers);
    console.log("Connected users length in useSocket:", connectedUsers.length);
  }, [connectedUsers]);

  const createRoom = () => {
    if (!socketRef.current) {
      toast.error("Socket not initialized");
      return;
    }
    setLoading(true);
    setError("");
    socketRef.current.emit("createRoom", (response: SocketResponse) => {
      setLoading(false);
      if (response.error) {
        setError(response.error);
        toast.error(response.error);
      } else if (response.roomCode) {
        setIsOwner(true);
        setConnectedUsers([
          {
            id: session?.user?.userId as string,
            name: session?.user?.name as string,
          },
        ]);
        router.push(`/joinedRoom/${response.roomCode}`);
      }
    });
  };

  const handleJoinRoom = async (joinRoomCode: string) => {
    if (!joinRoomCode || !socketRef.current) {
      toast.error("Socket not initialized or no room code provided");
      return;
    }
    setLoading(true);
    setError("");
    return new Promise((resolve, reject) => {
      socketRef.current!.emit(
        "joinRoom",
        joinRoomCode,
        (response: SocketResponse) => {
          setLoading(false);
          if (response.error) {
            setError(response.error);
            toast.error(
              response.error === "Room not found"
                ? "Room doesn’t exist"
                : response.error
            );
            router.push("/createjoin");
            reject(new Error(response.error));
          } else {
            setConnectedUsers(response.participants || []);
            setIsOwner(response.isOwner || false);
            router.push(`/joinedRoom/${joinRoomCode}`);
            resolve(response);
          }
        }
      );
    });
  };

  const leaveRoom = (roomCode: string | undefined) => {
    if (!socketRef.current || !roomCode) {
      toast.error("Socket not connected or no room code provided");
      return;
    }
    socketRef.current.emit(
      "leaveRoom",
      roomCode,
      (response: SocketResponse) => {
        if (response.error) {
          toast.error(response.error);
        } else {
          toast.success(response.message || "Left room successfully");
          router.push("/createjoin");
        }
      }
    );
  };

  const createPoll = (
    roomCode: string,
    track: {
      trackId: string;
      songName: string;
      artistName: string | string[];
      albumName: string;
      imageUrl: string;
    },
    callback?: (response: SocketResponse & { pollId?: string }) => void
  ) => {
    if (!socketRef.current) {
      toast.error("Socket not initialized");
      return;
    }
    socketRef.current.emit("createPoll", { roomCode, track }, callback);
  };

  const votePoll = (
    roomCode: string,
    pollId: string,
    vote: boolean,
    callback?: (response: SocketResponse) => void
  ) => {
    if (!socketRef.current) {
      toast.error("Socket not initialized");
      return;
    }
    socketRef.current.emit("votePoll", { roomCode, pollId, vote }, callback);
  };

  const closePoll = (
    roomCode: string,
    pollId: string,
    callback?: (
      response: SocketResponse & {
        yesPercentage?: number;
        addedToQueue?: boolean;
      }
    ) => void
  ) => {
    if (!socketRef.current) {
      toast.error("Socket not initialized");
      return;
    }
    socketRef.current.emit("closePoll", { roomCode, pollId }, callback);
  };

  return {
    socket: socketRef.current,
    isOwner,
    setIsOwner,
    connectedUsers,
    setConnectedUsers,
    error,
    setError,
    loading,
    setLoading,
    createRoom,
    handleJoinRoom,
    leaveRoom,
    polls,
    createPoll,
    votePoll,
    closePoll,
  };
};
