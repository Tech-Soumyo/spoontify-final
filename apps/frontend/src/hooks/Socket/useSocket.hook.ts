import { track } from "@/types/song.type";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const [connectedUser, setConnectedUser] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
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

    const handleJoinedUser = (userId: string) => {
      setConnectedUser((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    };

    const handleLeftUser = (userId: string) => {
      setConnectedUser((prev) => prev.filter((id) => id !== userId));
    };

    socketInstance.on("userJoined", handleJoinedUser);
    socketInstance.on("userLeft", handleLeftUser);
    socketInstance.on("participantsUpdated", setConnectedUser);
    socketInstance.on("roomClosed", () => router.push("/createjoin"));
    socketInstance.on("forceDisconnect", () => router.push("/createjoin"));

    return () => {
      socketInstance.off("userJoined", handleJoinedUser);
      socketInstance.off("userLeft", handleLeftUser);
      socketInstance.off("participantsUpdated", setConnectedUser);
      socketInstance.off("roomClosed", () => router.push("/createjoin"));
      socketInstance.off("forceDisconnect", () => router.push("/createjoin"));
    };
  }, [session, roomCode, router, isOwner, session?.accessToken]);
};
