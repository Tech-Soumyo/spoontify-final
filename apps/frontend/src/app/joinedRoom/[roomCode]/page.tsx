"use client";
import { Header } from "@/components/custom/Header";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

export default function JoinedRoomPage() {
  const params = useParams();
  const roomCode = Array.isArray(params.roomCode)
    ? params.roomCode[0]
    : params.roomCode;

  const { data: session } = useSession();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header
        connectedUsers={connectedUsers}
        roomCode={roomCode as string}
        onLeave={() => {
          leaveRoom(roomCode);
          console.log("LeaveRoom Page 2 ");
        }}
      />
      <button
        onClick={() => {
          console.log(connectedUsers.length);
        }}
        className="bg-blue"
      >
        users
      </button>
    </div>
  );
}
