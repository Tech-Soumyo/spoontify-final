"use client";
import { Header } from "@/components/custom/Header";
import { NowPlaying } from "@/components/custom/NowPlaying";
import { SearchSection } from "@/components/custom/SearchSection";
import { QueueSection } from "@/components/custom/QueueList"; // Verify path
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { track } from "@/types/song.type";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import refreshSpotifyToken from "@/hooks/refreshToaken";
import searchSongs from "@/hooks/useSpotifySearch";

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
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (session?.error) {
      toast.error(`Session error: ${session.error}`);
    }
  }, [session]);

  // const handleSearch = useCallback(
  //   async (searchQuery: string) => {
  //     if (!searchQuery.trim()) {
  //       setSearchError("Please enter a search query");
  //       return;
  //     }

  //     setSearchLoading(true);
  //     setSearchError(null);

  //     try {
  //       const response = await axios.post(
  //         `${process.env.NEXT_PUBLIC_BACKEND_URL}/spotify/search`,
  //         { roomCode, query: searchQuery },
  //         { headers: { "Content-Type": "application/json" } }
  //       );
  //       setSearchResults(response.data.results || []);
  //     } catch (error: any) {
  //       setSearchError(error.response?.data?.error || "Failed to search songs");
  //       toast.error(error.response?.data?.error || "Failed to search songs");
  //     } finally {
  //       setSearchLoading(false);
  //     }
  //   },
  //   [roomCode]
  // );

  // Handle song search
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchError("Please enter a search query");
        return;
      }

      if (!roomCode) {
        setSearchError("Room code is missing");
        return;
      }

      setSearchLoading(true);
      setSearchError(null);
      try {
        const results = await searchSongs(roomCode, searchQuery);
        if (!results) {
          throw new Error("No results found");
        }

        // Transform results to match expected track type
        const formattedResults = results.map((result: any) => ({
          id: result.id,
          name: result.name,
          artists: Array.isArray(result.artists)
            ? result.artists.map((name: string) => ({ name }))
            : [{ name: result.artists }],
          album: {
            name: result.album.name,
            imageUrl: result.album.imageUrl || "",
            images: result.album.images || [],
          },
          preview_url: result.previewUrl || "",
          popularity: result.popularity,
          uri: result.uri,
          duration_ms: result.duration_ms,
        }));
        setSearchResults(formattedResults || []);
      } catch (error: any) {
        setSearchError(error.message || "Failed to search songs");
        toast.error(error.message || "Failed to search songs");
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
        console.log("Add to queue error:", error);
        toast.error("Failed to add song to queue");
      }
    },
    [roomCode, socket]
  );

  // Refresh session manually
  const refreshSession = useCallback(async () => {
    try {
      await axios.get("/api/auth/session"); // Triggers session refresh
    } catch (error) {
      console.log("Session refresh error:", error);
      toast.error("Failed to refresh session");
    }
  }, []);

  // Play track
  const handlePlayTrack = useCallback(
    async (track: track, retryCount = 0) => {
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

        try {
          await axios.delete("/api/room/queue/remove", {
            data: { roomCode, trackId: track.id },
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.log("Queue remove error:", error);
          toast.error("Failed to remove track from queue");
        }

        const updatedQueue = queue.filter((t) => t.id !== track.id);
        setQueue(updatedQueue);
        socket?.emit("queueUpdated", { roomCode, queue: updatedQueue });
        if (updatedQueue.length === 0) {
          socket?.emit("queueEmpty", { roomCode });
        }
      } catch (error: any) {
        if (error.response?.status === 401 && retryCount < 1) {
          const newToken = await refreshSpotifyToken(session.refreshToken!);
          if (newToken) {
            // refreshSpotifyToken already updates tokens via /api/auth/update-token
            await refreshSession(); // Refresh session to get new token
            handlePlayTrack(track, retryCount + 1);
          } else {
            toast.error("Failed to refresh token");
          }
        } else {
          console.log("Play error:", error);
          toast.error("Failed to play track");
        }
      }
    },
    [player, deviceId, session, queue, socket, roomCode, refreshSession]
  );

  const handleSeek = useCallback(
    async (positionMs: number, retryCount = 0) => {
      if (!player || !deviceId || !session?.accessToken) {
        toast.error("Spotify player not ready");
        return;
      }
      try {
        await axios.put(
          `https://api.spotify.com/v1/me/player/seek?device_id=${deviceId}&position_ms=${positionMs}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        setPlaybackProgress(positionMs);
        socket?.emit("playbackUpdate", {
          roomCode,
          currentTrack,
          isPlaying,
          playbackProgress: positionMs,
        });
      } catch (error: any) {
        if (error.response?.status === 401 && retryCount < 1) {
          const newToken = await refreshSpotifyToken(session.refreshToken!);
          if (newToken) {
            await refreshSession();
            handleSeek(positionMs, retryCount + 1);
          } else {
            toast.error("Failed to refresh token");
          }
        } else {
          console.log("Seek error:", error);
          toast.error("Failed to seek track");
        }
      }
    },
    [
      player,
      deviceId,
      session,
      currentTrack,
      isPlaying,
      socket,
      roomCode,
      refreshSession,
    ]
  );

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.togglePlay().catch((error) => {
      console.log("Play/Pause error:", error);
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
        const expiresAt = Number(session.expires) || Date.now() + 3600 * 1000;
        if (Date.now() > expiresAt) {
          const newToken = await refreshSpotifyToken(session.refreshToken!);
          if (newToken) {
            token = newToken.accessToken;
            await refreshSession(); // Refresh session
          }
        }
        cb(token);
      },
      volume: 0.5,
    });

    let isMounted = true;

    spotifyPlayer.addListener("ready", ({ device_id }) => {
      if (isMounted) {
        console.log("Spotify Player ready with Device ID:", device_id);
        setDeviceId(device_id);
      }
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state || !isMounted) return;

      console.log("Disallows:", state.disallows);
      console.log("Restrictions:", state.restrictions);
      const track = state.track_window.current_track;

      if (track && isMounted) {
        setCurrentTrack({
          id: track.id ?? "",
          name: track.name,
          artists: track.artists.map((artist) => ({ name: artist.name })),
          album: {
            name: track.album.name,
            imageUrl: track.album.images[0]?.url ?? "",
            images: track.album.images,
          },
          popularity: 0,
          preview_url: "",
          uri: track.uri,
          duration_ms: track.duration_ms,
        });
        setPlaybackProgress(state.position);
      } else if (isMounted) {
        setCurrentTrack(null);
        setPlaybackProgress(0);
      }

      if (isMounted) {
        setIsPlaying(!state.paused);
      }

      // Enhanced track end detection
      if (
        isMounted &&
        state.paused &&
        state.position >= state.duration - 1000 &&
        !state.disallows.peeking_next &&
        queue.length > 0
      ) {
        const nextTrack = queue[0];
        if (nextTrack) {
          console.log("Track ended, playing next from queue:", nextTrack.name);
          handlePlayTrack(nextTrack);
        }
      } else if (
        isMounted &&
        state.paused &&
        state.position >= state.duration - 1000 &&
        queue.length === 0 &&
        currentTrack
      ) {
        socket?.emit("queueEmpty", { roomCode });
      }

      // Emit playback update for non-owners
      if (isMounted && socket) {
        socket.emit("playbackUpdate", {
          roomCode,
          currentTrack: track
            ? {
                id: track.id ?? "",
                name: track.name,
                artists: track.artists.map((artist) => ({ name: artist.name })),
                album: {
                  name: track.album.name,
                  imageUrl: track.album.images[0]?.url ?? "",
                  images: track.album.images,
                },
                preview_url: null,
                popularity: 0,
                uri: track.uri,
                duration_ms: track.duration_ms,
              }
            : null,
          isPlaying: !state.paused,
          playbackProgress: state.position,
        });
      }
    });

    spotifyPlayer.addListener("initialization_error", ({ message }) => {
      if (isMounted) {
        console.log("Spotify Player initialization error:", message);
        toast.error("Failed to initialize Spotify player");
      }
    });

    spotifyPlayer.addListener("authentication_error", async ({ message }) => {
      if (isMounted) {
        console.log("Spotify Player authentication error:", message);
        const newToken = await refreshSpotifyToken(session!.refreshToken!);
        if (newToken) {
          await refreshSession();
        } else {
          toast.error("Spotify authentication failed");
        }
      }
    });

    spotifyPlayer.connect();
    setPlayer(spotifyPlayer);

    return () => {
      isMounted = false;
      spotifyPlayer.disconnect();
      setPlayer(null);
    };
  }, [
    isOwner,
    session?.accessToken,
    session?.refreshToken,
    refreshSession,
    roomCode,
    socket,
  ]);

  useEffect(() => {
    if (!isPlaying || !currentTrack) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }

    progressTimerRef.current = setInterval(() => {
      setPlaybackProgress((prev) => {
        const newProgress = prev + 1000; // Increment by 1 second
        if (newProgress >= (currentTrack?.duration_ms || 0)) {
          clearInterval(progressTimerRef.current!);
          return prev; // Stop at duration
        }
        return newProgress;
      });
    }, 1000);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isPlaying, currentTrack]);

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

  // Fetch initial queue
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await axios.get(`/api/room/queue/${roomCode}`);
        setQueue(response.data.queue || []);
      } catch (error) {
        console.log("Fetch queue error:", error);
        toast.error("Failed to fetch queue");
      }
    };
    if (roomCode) fetchQueue();
  }, [roomCode]);

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
          onSeek={handleSeek}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
