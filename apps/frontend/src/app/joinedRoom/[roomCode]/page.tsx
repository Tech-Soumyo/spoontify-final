"use client";
import { Header } from "@/components/custom/Header";
import { NowPlaying } from "@/components/custom/NowPlaying";
import { SearchSection } from "@/components/custom/SearchSection";
import { QueueSection } from "@/components/custom/QueueList";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { track } from "@/types/song.type";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
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
  const lastPlayedTrackIdRef = useRef<string | null>(null);
  const isPlayingTrackRef = useRef<boolean>(false); // Track if a play is in progress

  useEffect(() => {
    if (session?.error) {
      toast.error(`Session error: ${session.error}`);
    }
  }, [session]);

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
        // Emit queue update through the existing socket connection
        if (socket && socket.connected) {
          socket.emit("queueUpdated", { roomCode, queue: updatedQueue });
        }
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
      await axios.get("/api/auth/session");
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
      if (isPlayingTrackRef.current) {
        console.log("Play in progress, skipping duplicate call for:", track.id);
        return;
      }
      isPlayingTrackRef.current = true;

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

        setCurrentTrack(track);
        setPlaybackProgress(0);
        setIsPlaying(true);
        lastPlayedTrackIdRef.current = track.id;

        // Remove the track from the queue if it exists
        if (queue.some((t) => t.id === track.id)) {
          try {
            await axios.delete("/api/room/queue/remove", {
              data: { roomCode, trackId: track.id },
              headers: { "Content-Type": "application/json" },
            });
          } catch (error: any) {
            console.log("Queue remove error:", error);
            if (
              error.response?.data?.error?.includes(
                "Record to delete does not exist"
              )
            ) {
              console.log("Track already removed from database:", track.id);
            } else {
              toast.error("Failed to remove track from queue");
            }
          }

          // Update local queue state
          const updatedQueue = queue.filter((t) => t.id !== track.id);
          setQueue(updatedQueue);
          socket?.emit("queueUpdated", { roomCode, queue: updatedQueue });
        } else {
          console.log("Track not in queue, skipping removal:", track.id);
        }

        // Emit playback update for non-owners
        socket?.emit("playbackUpdate", {
          roomCode,
          currentTrack: track,
          isPlaying: true,
          playbackProgress: 0,
        });
      } catch (error: any) {
        if (error.response?.status === 401 && retryCount < 1) {
          const newToken = await refreshSpotifyToken(session.refreshToken!);
          if (newToken) {
            await refreshSession();
            handlePlayTrack(track, retryCount + 1);
          } else {
            toast.error("Failed to refresh token");
          }
        } else {
          console.log("Play error:", error);
          toast.error("Failed to play track");
        }
      } finally {
        isPlayingTrackRef.current = false;
      }
    },
    [player, deviceId, session, queue, socket, roomCode, refreshSession]
  );

  // Seek to position
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
            await refreshSession();
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

      const track = state.track_window.current_track;

      if (track && isMounted) {
        // Only update if the track has changed
        if (track.id !== currentTrack?.id) {
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
        } else {
          // Update progress if the track is the same
          setPlaybackProgress(state.position);
        }
      } else if (isMounted && !track) {
        setCurrentTrack(null);
        setPlaybackProgress(0);
        setIsPlaying(false);
      }

      if (isMounted) {
        setIsPlaying(!state.paused);
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

  // Progress timer for continuous updates
  useEffect(() => {
    if (!isPlaying || !currentTrack || !currentTrack.duration_ms) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }

    progressTimerRef.current = setInterval(() => {
      setPlaybackProgress((prev) => {
        const newProgress = prev + 1000;
        if (
          newProgress >= (currentTrack.duration_ms || 0) - 500 &&
          !isPlayingTrackRef.current
        ) {
          clearInterval(progressTimerRef.current!);
          progressTimerRef.current = null;

          if (lastPlayedTrackIdRef.current === currentTrack.id) {
            handleSkip();
          }
          return currentTrack.duration_ms || 0;
        }
        // Emit updated progress to non-owners
        socket?.emit("playbackUpdate", {
          roomCode,
          currentTrack,
          isPlaying,
          playbackProgress: newProgress,
        });
        return newProgress;
      });
    }, 1000);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isPlaying, currentTrack, handleSkip, socket, roomCode]);

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
      setCurrentTrack(null); // Ensure NowPlaying clears on queueEmpty
      setPlaybackProgress(0);
      setIsPlaying(false);
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
          onSeek={handleSeek}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
