"use client";
// import { useSocket } from "@/hooks/useSocket2";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateJoinRoom() {
  const { data: session } = useSession();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  //   const { socket } = useSocket();

  //   const handleCreateRoom = () => {
  //     if (!session?.user?.spotifyId && session?.user?.isPremium != true) {
  //       setError("For Room Creation, First do Spotify Login.");
  //       return;
  //     }
  //     // Room creation logic (redirect to room page)
  //     setLoading(true);
  //     if (!socket) return;
  //     socket?.emit("createRoom", (response: any) => {
  //       setLoading(false);
  //       if (response.error) {
  //         setError(response.error);
  //       } else if (response.roomCode) {
  //         router.push(`/joinedRoom/${response.roomCode}`);
  //       }
  //     });
  //   };

  //   const handleJoinRoom = async () => {
  //     if (!roomCode) return;

  //     setLoading(true);
  //     socket?.emit("joinRoom", roomCode, (response: any) => {
  //       setLoading(false);
  //       if (response.error) {
  //         setError(response.error);
  //       } else if (response.success) {
  //         router.push(`/joinedRoom/${roomCode}`);
  //       }
  //     });
  //   };

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
          onClick={() => {}}
          disabled={loading || !roomCode}
        >
          {loading ? "Joining..." : "Join Room"}
        </button>

        {/* Create Room + Spotify Login */}
        <div className="flex gap-3">
          <button
            onClick={() => {}}
            className={`p-2 text-white rounded flex-1 ${
              session?.user?.spotifyId
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={
              !session?.user?.spotifyId && session?.user?.isPremium != true
            }
          >
            Create Room
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
