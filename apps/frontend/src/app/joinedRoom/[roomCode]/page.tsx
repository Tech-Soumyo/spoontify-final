"use client";
import { Header } from "@/components/custom/Header";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function JoinedRoomPage() {
  const params = useParams();
  const roomCode = Array.isArray(params.roomCode)
    ? params.roomCode[0]
    : params.roomCode;
  const { data: session } = useSession();
  const router = useRouter();
  const {
    connectedUsers,
    error,
    leaveRoom,
    socket,
    loading,
    setError,
    setLoading,
  } = useSocket(roomCode);

  // Log connectedUsers whenever it changes
  useEffect(() => {
    console.log("Connected users in JoinedRoomPage:", connectedUsers);
    console.log(
      "Connected users length in JoinedRoomPage:",
      connectedUsers.length
    );
  }, [connectedUsers]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header
        connectedUsers={connectedUsers}
        roomCode={roomCode as string}
        onLeave={() => {
          leaveRoom(roomCode);
          console.log("LeaveRoom Page 2");
        }}
      />
    </div>
  );
}
