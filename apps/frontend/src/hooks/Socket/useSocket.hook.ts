"use clent";
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

  // Check session readiness
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

    // Send heartbeat every 30 seconds
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
    };

    socketInstance.on("connect", () => console.log("Socket connected"));
    socketInstance.on("userJoined", handleUserJoined);
    socketInstance.on("participantsUpdated", setConnectedUsers);
    socketInstance.on("roomClosed", handleRoomClosed);
    socketInstance.on("userLeft", handleUserLeft);

    return () => {
      // Clear all intervals
      clearInterval(heartbeatInterval);

      // Remove specific listeners
      socketInstance.off("connect");
      socketInstance.off("userJoined", handleUserJoined);
      socketInstance.off("userLeft", handleUserLeft);
      socketInstance.off("participantsUpdated", setConnectedUsers);
      socketInstance.off("roomClosed", handleRoomClosed);

      socketInstance.disconnect();
    };
  }, [isSessionReady, session, roomCode, router]);

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
            name: session?.user?.name || "Owner",
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
    if (!socketRef.current) {
      toast.error("Socket not connected");
      return;
    }

    if (!roomCode) {
      toast.error("No room code provided");
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
  return {
    socket: socketRef.current,
    isOwner,
    connectedUsers,
    error,
    setError,
    loading,
    setLoading,
    createRoom,
    handleJoinRoom,
    leaveRoom,
  };
};
