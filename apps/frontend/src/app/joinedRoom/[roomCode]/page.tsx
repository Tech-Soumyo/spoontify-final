"use client";
import { Header } from "@/components/custom/Header";
import { NowPlaying } from "@/components/custom/NowPlaying";

import { SearchSection } from "@/components/custom/SearchSection";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { track } from "@/types/song.type";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { QueueSection } from "@/components/custom/QueueList";
import refreshSpotifyToken from "@/hooks/refreshToaken";

export default function JoinedRoomPage() {
  const params = useParams();
  const roomCode = Array.isArray(params.roomCode)
    ? params.roomCode[0]
    : params.roomCode;
  const { data: session } = useSession();
  const router = useRouter();
  const { connectedUsers, leaveRoom, socket, isOwner } = useSocket(roomCode);

  // States for search
  const [searchResults, setSearchResults] = useState<track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // States for queue
  const [queue, setQueue] = useState<track[]>([]);

  // States for playback
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [currentTrack, setCurrentTrack] = useState<track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  // Refresh Spotify access token

  // Handle song search
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchError("Please enter a search query");
        return;
      }

      setSearchLoading(true);
      setSearchError(null);

      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/spotify/search`,
          { roomCode, query: searchQuery },
          { headers: { "Content-Type": "application/json" } }
        );
        setSearchResults(response.data.results || []);
      } catch (error: any) {
        setSearchError(error.response?.data?.error || "Failed to search songs");
        toast.error(error.response?.data?.error || "Failed to search songs");
      } finally {
        setSearchLoading(false);
      }
    },
    [roomCode]
  );

  // Add to queue
  const handleAddToQueue = useCallback(
    async (track: track) => {
      try {
        const response = await axios.post(
          "/api/room/queue/add",
          {
            roomCode,
            track: {
              trackId: track.id,
              songName: track.name,
              artistName: track.artists.map((a) => a.name),
              albumName: track.album.name,
              imageUrl: track.album.imageUrl,
            },
          },
          { headers: { "Content-Type": "application/json" } }
        );

        const updatedQueue = response.data.queue;
        setQueue(updatedQueue);
        socket?.emit("queueUpdated", { roomCode, queue: updatedQueue });
        toast.success(`${track.name} added to queue`);
      } catch (error: any) {
        console.error("Add to queue error:", error);
        toast.error("Failed to add song to queue");
      }
    },
    [roomCode, socket]
  );

  // Play track
  const handlePlayTrack = useCallback(
    async (track: track) => {
      if (!player || !deviceId || !session?.accessToken) {
        toast.error("Spotify player not ready");
        return;
      }

      try {
        await axios.put(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          { uris: [track.uri] },
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        const updatedQueue = queue.filter((t) => t.id !== track.id);
        setQueue(updatedQueue);
        socket?.emit("queueUpdated", { roomCode, queue: updatedQueue });

        if (updatedQueue.length === 0) {
          socket?.emit("queueEmpty", { roomCode });
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          const newToken = await refreshSpotifyToken(session.refreshToken!);
          if (newToken) {
            // Update session storage with new token
            try {
              await axios.post("/api/auth/update-token", {
                accessToken: newToken.accessToken,
                refreshToken: newToken.refreshToken,
                expiresAt: newToken.accessTokenExpires,
              });

              // Optionally, trigger session refresh
              // await axios.get("/api/auth/session");

              // For current session usage
              session.accessToken = newToken.accessToken;
              handlePlayTrack(track); // Retry with new token
            } catch (tokenError) {
              console.error("Failed to update token:", tokenError);
              toast.error("Failed to refresh authentication");
            }
          } else {
            toast.error("Failed to refresh token");
          }
        } else {
          console.error("Play error:", error);
          toast.error("Failed to play track");
        }
      }
    },
    [player, deviceId, session, queue, socket, roomCode]
  );

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.togglePlay().catch((error) => {
      console.error("Play/Pause error:", error);
      toast.error("Failed to toggle playback");
    });
  }, [player]);

  const handleSkip = useCallback(() => {
    if (!player || queue.length === 0) {
      toast.error("No tracks to skip to");
      return;
    }
    const nextTrack = queue[0];
    if (nextTrack) {
      handlePlayTrack(nextTrack);
    }
  }, [player, queue, handlePlayTrack]);

  // Load Spotify SDK script
  useEffect(() => {
    if (!isOwner || !session?.accessToken) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [isOwner, session?.accessToken]);

  // Initialize Spotify Player
  useEffect(() => {
    if (!isOwner || !session?.accessToken || !window.Spotify) return;

    const spotifyPlayer = new window.Spotify.Player({
      name: "Spoontify Player",
      getOAuthToken: async (cb) => {
        let token = session.accessToken!;
        // Assume 1-hour expiration if accessTokenExpires is unavailable
        const expiresAt = Date.now() + 3600 * 1000;
        if (Date.now() > expiresAt) {
          const refreshedTokens = await refreshSpotifyToken(
            session.refreshToken!
          );
          if (refreshedTokens) {
            token = refreshedTokens.accessToken;
            // Update session with new access token
            try {
              await axios.post("/api/auth/update-token", {
                accessToken: refreshedTokens.accessToken,
                refreshToken: refreshedTokens.refreshToken,
              });
            } catch (error) {
              console.error("Failed to update session token:", error);
            }
          }
        }
        cb(token);
      },
      volume: 0.5,
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
      console.log("Spotify Player ready with Device ID:", device_id);
      setDeviceId(device_id);
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) return;

      const track = state.track_window.current_track;
      if (track) {
        setCurrentTrack({
          id: track.id!,
          name: track.name,
          artists: track.artists,
          album: {
            name: track.album.name,
            imageUrl: track.album.images[0]?.url || "",
            images: track.album.images,
          },
          popularity: 0,
          preview_url: "",
          uri: track.uri,
          duration_ms: track.duration_ms,
        });
      } else {
        setCurrentTrack(null);
      }
      setIsPlaying(!state.paused);
      setPlaybackProgress(state.position);

      // Detect track end
      if (state.paused && state.position === 0 && queue.length > 0) {
        const nextTrack = queue[0];
        if (nextTrack) {
          console.log("Track ended, playing next from queue:", nextTrack.name);
          handlePlayTrack(nextTrack);
        }
      } else if (
        state.paused &&
        state.position === 0 &&
        queue.length === 0 &&
        currentTrack
      ) {
        // Only emit queueEmpty if we had a track playing that has now ended
        socket?.emit("queueEmpty", { roomCode });
      }

      socket?.emit("playbackUpdate", {
        roomCode,
        currentTrack: track
          ? {
              id: track.id || "",
              name: track.name,
              artists: track.artists.map((artist) => ({ name: artist.name })),
              album: {
                name: track.album.name,
                imageUrl: track.album.images[0]?.url || "",
                images: track.album.images,
              },
              preview_url: "",
              popularity: 0,
              uri: track.uri,
              duration_ms: track.duration_ms,
            }
          : null,
        isPlaying: !state.paused,
        playbackProgress: state.position,
      });
    });

    spotifyPlayer.addListener("initialization_error", ({ message }) => {
      console.error("Spotify Player initialization error:", message);
      toast.error("Failed to initialize Spotify player");
    });

    spotifyPlayer.addListener("authentication_error", async ({ message }) => {
      console.error("Spotify Player authentication error:", message);
      const newToken = await refreshSpotifyToken(session.refreshToken!);
      if (newToken) {
        // Note: Update session.accessToken in production via API/db
      } else {
        toast.error("Spotify authentication failed");
      }
    });

    spotifyPlayer.connect();
    setPlayer(spotifyPlayer);

    return () => {
      spotifyPlayer.disconnect();
    };
  }, [
    isOwner,
    session?.accessToken,
    socket,
    queue,
    handlePlayTrack,
    refreshSpotifyToken,
  ]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket) return;

    socket.on(
      "playbackUpdate",
      ({ currentTrack, isPlaying, playbackProgress }) => {
        setCurrentTrack(currentTrack);
        setIsPlaying(isPlaying);
        setPlaybackProgress(playbackProgress);
      }
    );

    socket.on("queueUpdated", ({ queue }) => {
      setQueue(queue);
    });

    socket.on("queueEmpty", () => {
      toast.info("Queue is empty");
    });

    return () => {
      socket.off("playbackUpdate");
      socket.off("queueUpdated");
      socket.off("queueEmpty");
    };
  }, [socket]);

  // Fetch initial queue when joining a room
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await axios.get(
          `/api/room/queue?roomCode=${roomCode}`
        );
        setQueue(response.data.queue || []);
      } catch (error) {
        console.error("Fetch queue error:", error);
        toast.error("Failed to fetch queue");
      }
    };
    if (roomCode) fetchQueue();
  }, [roomCode]);

  // Debug connected users
  useEffect(() => {
    console.log("Connected users in JoinedRoomPage:", connectedUsers);
    console.log("Connected users length:", connectedUsers.length);
  }, [connectedUsers]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header
        connectedUsers={connectedUsers}
        roomCode={roomCode as string}
        onLeave={() => {
          leaveRoom(roomCode);
          router.push("/createjoin");
        }}
      />
      <div className="container mx-auto p-4">
        <SearchSection
          onSearch={handleSearch}
          searchResults={searchResults}
          onAddToQueue={handleAddToQueue}
          loading={searchLoading}
          error={searchError}
        />
        <QueueSection
          queue={queue}
          isOwner={isOwner}
          onPlayTrack={handlePlayTrack}
        />
        <NowPlaying
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          playbackProgress={playbackProgress}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
