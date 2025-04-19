import { track } from "@/types/song.type";
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
interface RoomData {
  ownerId: string;
  ownerName: string;
  ownerAccessToken?: string;
  ownerRefreshRocken?: string;
  participants: string[];
  queue: any[];
  currentTrack: track | null;
  isPlaying: boolean;
  error: any | null;
}

export const useSocket = (roomCode?: string) => {
  const { data: session } = useSession();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  // const playerRef = useRef<Spotify.Player | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!session?.user || (socketRef.current && socketRef.current.connected))
      return;

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
      auth: {
        session: {
          user: {
            ...session.user,
            spotifyAccessToken: session.accessToken,
            spotifyRefreshToken: session.refreshToken,
          },
        },
      },
      reconnection: true,
      transports: ["websocket"],
    });

    socketRef.current = socketInstance;

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

    // const handleLeftUser = (userId: string) => {
    //   setConnectedUser((prev) => prev.filter((id) => id !== userId));
    // };
    socketInstance.on("connect", () => console.log("Socket connected"));
    socketInstance.on("userJoined", handleUserJoined);
    // socketInstance.on("userLeft", handleLeftUser);
    socketInstance.on("participantsUpdated", setConnectedUsers);
    socketInstance.on("roomClosed", () => {
      toast.info("Room has been closed");
      router.push("/createjoin");
    });
    // socketInstance.on("forceDisconnect", () => router.push("/createjoin"));

    return () => {
      socketInstance.off("userJoined", handleUserJoined);
      // socketInstance.off("userLeft", handleLeftUser);
      socketInstance.off("participantsUpdated", setConnectedUsers);
      socketInstance.off("roomClosed", () => router.push("/createjoin"));
      // socketInstance.off("forceDisconnect", () => router.push("/createjoin"));
    };
  }, [session, roomCode, router, isOwner, session?.accessToken]);

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
    if (!socketRef.current || !roomCode) return;

    socketRef.current.emit(
      "leaveRoom",
      roomCode,
      (response: SocketResponse) => {
        if (response.error) {
          toast.error(response.error);
        } else {
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
    loading,
    createRoom,
    handleJoinRoom,
    leaveRoom,
  };
};
