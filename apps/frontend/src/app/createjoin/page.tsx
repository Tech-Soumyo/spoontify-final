"use client";
import { SocketResponse, useSocket } from "@/hooks/Socket/useSocket.hook";
// import { useSocket } from "@/hooks/useSocket2";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function CreateJoinRoom() {
  const { data: session } = useSession();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const {
    socket,
    createRoom,
    handleJoinRoom,
    setIsOwner,
    setConnectedUsers,
    connectedUsers,
  } = useSocket();

  const handleCreateRoom = () => {
    if (!session?.user?.spotifyId && session?.user?.isPremium !== true) {
      setError("For Room Creation, First do Spotify Login.");
      return;
    }
    createRoom();
  };

  const handleJoiningRoom = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      await handleJoinRoom(roomCode);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div>
        <button
          onClick={() => {
            signOut({ redirect: false });
            console.log("Sign out");
            router.push("/");
          }}
          className="bg-red-700"
        >
          Sign out
        </button>
      </div>
      <div className="p-6 bg-white rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Join or Create a Room</h2>

        {/* Room Code Input */}
        <input
          type="text"
          placeholder="Enter Room Code"
          className="p-2 border rounded w-full mb-3"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />
        <button
          className="p-2 bg-green-500 text-white rounded w-full mb-3"
          onClick={handleJoiningRoom}
          disabled={loading || !roomCode}
        >
          {loading ? "Joining..." : "Join Room"}
        </button>

        {/* Create Room + Spotify Login */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              handleCreateRoom();
              console.log("connectedUsers" + JSON.stringify(connectedUsers));
            }}
            className={`p-2 text-white rounded flex-1 ${
              session?.user?.spotifyId
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={
              loading ||
              (!session?.user?.spotifyId && session?.user?.isPremium !== true)
            }
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
          <button
            onClick={() => signIn("spotify")}
            className="p-2 bg-black text-white rounded"
          >
            Spotify Login
          </button>
        </div>

        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
