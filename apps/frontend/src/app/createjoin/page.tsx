"use client";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function CreateJoinRoom() {
  const { data: session, status } = useSession();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { createRoom, handleJoinRoom } = useSocket();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      toast.error(`You must be logged in to create or join a room`);
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  const handleCreateRoom = () => {
    if (!session?.user?.spotifyId || !session?.accessToken) {
      setError("For Room Creation, you must connect with Spotify first.");
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
            router.push("/login");
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

        <div className="flex gap-3">
          <button
            onClick={() => {
              handleCreateRoom();
            }}
            className={`p-2 text-white rounded flex-1 ${
              session?.user?.spotifyId
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={
              loading ||
              (!session?.user?.spotifyId &&
                session?.user?.isPremium &&
                !session.accessToken)
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
