"use client";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { debounce } from "lodash";

export type SocketResponse = {
  error?: string;
  code?: string;
  roomCode?: string;
  participants?: { id: string; name: string }[];
  isOwner?: boolean;
  message?: string;
};

const SOCKET_TIMEOUT = 10000;
const ROOM_CODE_REGEX = /^[A-Za-z0-9]{6}$/;

export const useSocket = (roomCode?: string) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  const debouncedToast = useCallback(
    debounce(
      (message: string, type: "success" | "error" | "info") => {
        toast[type](message);
      },
      1000,
      { leading: true, trailing: false }
    ),
    []
  );

  useEffect(() => {
    return () => {
      setError("");
    };
  }, [pathname]);

  useEffect(() => {
    if (status === "loading") {
      initTimeoutRef.current = setTimeout(() => {
        if (!isSessionReady) {
          debouncedToast("Session initialization timeout", "error");
          setError("Failed to initialize session");
        }
      }, SOCKET_TIMEOUT);
    }

    if (session?.user?.userId) {
      setIsSessionReady(true);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    }

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [session, status, debouncedToast]);

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
      timeout: SOCKET_TIMEOUT,
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
      debouncedToast(`${name} joined the room`, "info");
    };

    const handleRoomClosed = () => {
      debouncedToast("Room has been closed", "info");
      router.push("/createjoin");
    };

    const handleUserLeft = ({
      userId,
      name,
    }: {
      userId: string;
      name: string;
    }) => {
      debouncedToast(`${name} left the room`, "info");
      setConnectedUsers((prev) => prev.filter((u) => u.id !== userId));
    };

    const handleParticipantsUpdated = (
      participants: { id: string; name: string }[]
    ) => {
      setConnectedUsers(participants);
    };

    socketInstance.on("connect", () => {
      setError("");
    });

    socketInstance.on("connect_error", (err) => {
      setError(`Connection error: ${err.message}`);
      debouncedToast("Failed to connect to server", "error");
    });

    socketInstance.on("userJoined", handleUserJoined);
    socketInstance.on("participantsUpdated", handleParticipantsUpdated);
    socketInstance.on("roomClosed", handleRoomClosed);
    socketInstance.on("userLeft", handleUserLeft);

    if (roomCode) {
      if (!ROOM_CODE_REGEX.test(roomCode)) {
        setError("Invalid room code format");
        return;
      }

      socketInstance.emit("joinRoom", roomCode, (response: SocketResponse) => {
        if (response.error) {
          setError(response.error);
          debouncedToast(response.error, "error");
        } else {
          setError("");
          setConnectedUsers(response.participants || []);
          setIsOwner(response.isOwner || false);
        }
      });
    }

    return () => {
      clearInterval(heartbeatInterval);
      socketInstance.off("connect");
      socketInstance.off("connect_error");
      socketInstance.off("userJoined", handleUserJoined);
      socketInstance.off("participantsUpdated", handleParticipantsUpdated);
      socketInstance.off("roomClosed", handleRoomClosed);
      socketInstance.off("userLeft", handleUserLeft);
      socketInstance.disconnect();
    };
  }, [isSessionReady, session, roomCode, router, debouncedToast]);

  useEffect(() => {
    console.log("Updated connectedUsers in useSocket:", connectedUsers);
    console.log("Connected users length in useSocket:", connectedUsers.length);
  }, [connectedUsers]);

  const createRoom = () => {
    if (!socketRef.current) {
      const error = "Socket not initialized";
      setError(error);
      debouncedToast(error, "error");
      return Promise.reject(new Error(error));
    }

    setLoading(true);
    setError("");

    return new Promise<SocketResponse>((resolve, reject) => {
      socketRef.current!.emit("createRoom", (response: SocketResponse) => {
        setLoading(false);
        if (response.error) {
          setError(response.error);
          debouncedToast(response.error, "error");
          reject(new Error(response.error));
        } else if (response.roomCode) {
          setError("");
          setIsOwner(true);
          setConnectedUsers([
            {
              id: session?.user?.userId as string,
              name: session?.user?.name as string,
            },
          ]);
          router.push(`/joinedRoom/${response.roomCode}`);
          resolve(response);
        }
      });
    });
  };

  const handleJoinRoom = async (joinRoomCode: string) => {
    if (!ROOM_CODE_REGEX.test(joinRoomCode)) {
      const error = "Invalid room code format";
      setError(error);
      debouncedToast(error, "error");
      return Promise.reject(new Error(error));
    }

    if (!socketRef.current) {
      const error = "Socket not initialized";
      setError(error);
      debouncedToast(error, "error");
      return Promise.reject(new Error(error));
    }

    setLoading(true);
    setError("");

    return new Promise<SocketResponse>((resolve, reject) => {
      socketRef.current!.emit(
        "joinRoom",
        joinRoomCode,
        (response: SocketResponse) => {
          setLoading(false);
          if (response.error) {
            setError(response.error);
            debouncedToast(
              response.error === "Room not found"
                ? "Room doesn't exist"
                : response.error,
              "error"
            );
            router.push("/createjoin");
            reject(new Error(response.error));
          } else {
            setError("");
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
      const error = "Socket not connected or no room code provided";
      setError(error);
      debouncedToast(error, "error");
      return Promise.reject(new Error(error));
    }

    return new Promise<SocketResponse>((resolve, reject) => {
      socketRef.current!.emit(
        "leaveRoom",
        roomCode,
        (response: SocketResponse) => {
          if (response.error) {
            setError(response.error);
            debouncedToast(response.error, "error");
            reject(new Error(response.error));
          } else {
            setError("");
            debouncedToast(
              response.message || "Left room successfully",
              "success"
            );
            router.push("/createjoin");
            resolve(response);
          }
        }
      );
    });
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
  };
};
