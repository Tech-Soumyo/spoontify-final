"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { track } from "@/hooks/useSpotySong";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { searchSongs } from "@/hooks/useSpotifySearch";
import axios from "axios";
import Image from "next/image";
import img from "../../../../public/interior.jpg";
import { getAverageColor } from "@/utils/imageAverageColor";
import refreshSpotifyToken from "@/hooks/refreshToaken";
import { CirclePower } from "lucide-react";
import { NowPlaying } from "@/components/custom/glass/NowPlaying2";
import { QueueSection } from "@/components/custom/glass/QueueSection";
import { SearchSection } from "@/components/custom/glass/SearchSection2";
import { ChatSection } from "@/components/custom/glass/ChatSection2";

export default function JoinedRoomPage() {
  const params = useParams();
  const roomCode = Array.isArray(params.roomCode)
    ? params.roomCode[0]
    : params.roomCode;
  const { data: session, status } = useSession();
  const router = useRouter();
  const { connectedUsers, leaveRoom, socket, isOwner } = useSocket(roomCode);

  // search
  const [searchResults, setSearchResults] = useState<track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // queue
  const [queue, setQueue] = useState<track[]>([]);

  // playback
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [currentTrack, setCurrentTrack] = useState<track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayedTrackIdRef = useRef<string | null>(null);
  const isPlayingTrackRef = useRef<boolean>(false);

  // Background color state
  const [backgroundColor, setBackgroundColor] =
    useState<string>("rgba(0, 0, 0, 0.5)");

  // Extract average color from album cover
  useEffect(() => {
    if (!currentTrack || !currentTrack.album.imageUrl) {
      setBackgroundColor("rgba(0, 0, 0, 0.5)"); // Fallback color
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "Anonymous"; // Handle cross-origin images
    img.src = currentTrack.album.imageUrl;

    img.onload = async () => {
      try {
        const color = await getAverageColor(img);
        const rgbColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`; // Add opacity
        setBackgroundColor(rgbColor);
      } catch (error) {
        console.error("Error extracting color:", error);
        setBackgroundColor("rgba(0, 0, 0, 0.5)");
      }
    };

    img.onerror = () => {
      console.error("Failed to load album cover image");
      setBackgroundColor("rgba(0, 0, 0, 0.5)");
    };
  }, [currentTrack]);

  useEffect(() => {
    if (session?.error) {
      toast.error(`Session error: ${session.error}`);
    }
    if (status === "unauthenticated") {
      toast.error("You need to be authenticated to access this page");
      router.push("/createjoin");
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
        // Check if the track is currently playing
        if (currentTrack && currentTrack.id === track.id) {
          toast.error("This song is currently playing");
          return;
        }

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
        const errorMessage =
          error.response?.data?.error || "Failed to add song to queue";
        toast.error(errorMessage);
      }
    },
    [roomCode, socket, currentTrack]
  );

  const handleRemoveTrack = useCallback(
    async (track: track) => {
      try {
        const response = await axios.delete("/api/room/queue/remove", {
          data: { roomCode, trackId: track.id },
          headers: { "Content-Type": "application/json" },
        });

        const updatedQueue = response.data.queue;
        setQueue(updatedQueue);
        socket?.emit("queueUpdated", { roomCode, queue: updatedQueue });
        toast.success(`${track.name} removed from queue`);
      } catch (error: any) {
        console.log("Remove from queue error:", error);
        const errorMessage =
          error.response?.data?.error || "Failed to remove song from queue";
        toast.error(errorMessage);
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

  // Handle volume change
  const handleVolumeChange = useCallback(
    async (newVolume: number, retryCount = 0) => {
      if (!player || !deviceId || !session?.accessToken) {
        toast.error("Spotify player not ready");
        return;
      }
      try {
        await axios.put(
          `https://api.spotify.com/v1/me/player/volume?device_id=${deviceId}&volume_percent=${Math.round(newVolume * 100)}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        setVolume(newVolume);
        player.setVolume(newVolume);
      } catch (error: any) {
        if (error.response?.status === 401 && retryCount < 1) {
          const newToken = await refreshSpotifyToken(session.refreshToken!);
          if (newToken) {
            await refreshSession();
            handleVolumeChange(newVolume, retryCount + 1);
          } else {
            toast.error("Failed to refresh token");
          }
        } else {
          console.log("Volume change error:", error);
          toast.error("Failed to change volume");
        }
      }
    },
    [player, deviceId, session, refreshSession]
  );

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
      volume: volume,
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

  // Verify room exists and fetch initial queue
  useEffect(() => {
    const fetchQueueAndVerifyRoom = async () => {
      try {
        const response = await axios.get(`/api/room/queue/${roomCode}`);
        setQueue(response.data.queue || []);
      } catch (error: any) {
        console.log("Fetch queue error:", error);
        if (error.response?.status === 404) {
          toast.error("Room doesn't exist");
          router.push("/createjoin");
          return;
        }
        toast.error("Failed to fetch queue");
      }
    };
    if (roomCode) fetchQueueAndVerifyRoom();
  }, [roomCode, router]);

  useEffect(() => {
    console.log("Connected users in JoinedRoomPage:", connectedUsers);
    console.log("Connected users length:", connectedUsers.length);
  }, [connectedUsers]);

  return (
    <div className="relative min-h-screen w-full">
      {/* Background Image */}
      <Image
        src={img}
        alt="Interior background"
        fill
        className="object-cover"
        quality={100}
      />

      {/* Dynamic Background Overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: backgroundColor,
          transition: "background-color 0.5s ease",
        }}
      />

      {showSearchResults && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-40" />
      )}

      <div className="relative h-full min-h-screen bg-white/10">
        <div className="container mx-auto p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar with queue & play */}
            <div className="backdrop-blur-md bg-black/30 rounded-2xl w-full lg:w-[400px] h-auto lg:min-h-[90vh] border border-white/30 shadow-xl flex flex-col">
              <div className="p-4 border-b border-white/20">
                <h1 className="text-2xl font-bold text-white/90 text-center">
                  SPOONIFY
                </h1>
              </div>

              <div className="p-4 flex justify-center items-center gap-4">
                <button
                  onClick={() => {
                    leaveRoom(roomCode);
                    router.push("/createjoin");
                  }}
                  className="w-16 h-16 aspect-square rounded-full bg-red-500/30 backdrop-blur-sm border border-red-500/50 text-white hover:bg-red-500/40 transition-all duration-300 shadow-lg hover:shadow-red-500/20 flex items-center justify-center"
                >
                  <CirclePower className="w-8 h-8" />
                </button>

                <button
                  onClick={() => {
                    if (roomCode) navigator.clipboard.writeText(roomCode);
                    toast.success("Room code copied to clipboard!");
                  }}
                  className="w-16 h-16 aspect-square rounded-full bg-emerald-500/30 backdrop-blur-sm border border-emerald-500/50 text-white hover:bg-emerald-500/40 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-8 h-8"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>

              {/* Queue Section */}
              <div className="flex-1 overflow-hidden mt-10 min-h-0">
                <QueueSection
                  queue={queue}
                  isOwner={isOwner}
                  onPlayTrack={handlePlayTrack}
                  onRemoveTrack={handleRemoveTrack}
                />
              </div>

              {/* Now Playing Section */}
              <div className="p-4 mt-auto border-t border-white/20 mb-4 ">
                <NowPlaying
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  playbackProgress={playbackProgress}
                  onPlayPause={handlePlayPause}
                  onSkip={handleSkip}
                  onSeek={handleSeek}
                  isOwner={isOwner}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {/* Search Section */}
              <div className="backdrop-blur-md bg-black/20 rounded-2xl w-full border border-white/30 shadow-xl relative z-50 mb-8">
                <SearchSection
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  onAddToQueue={handleAddToQueue}
                  loading={searchLoading}
                  error={searchError}
                  onShowResultsChange={setShowSearchResults}
                  roomCode={roomCode!} // Pass roomCode prop
                />
              </div>

              {/* Chat area */}
              <div
                className={`backdrop-blur-md bg-black/20 rounded-2xl w-full flex-1 min-h-[70vh] border border-white/30 shadow-xl ${
                  showSearchResults ? "z-30" : "z-0"
                }`}
              >
                {roomCode && <ChatSection roomCode={roomCode} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
