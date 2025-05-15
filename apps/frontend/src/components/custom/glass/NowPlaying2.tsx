"use client";

import { track } from "@/hooks/useSpotySong";
import { useCallback } from "react";

type NowPlayingProps = {
  currentTrack: track | null;
  isPlaying: boolean;
  playbackProgress: number;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (positionMs: number) => void;
  isOwner: boolean;
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const NowPlaying: React.FC<NowPlayingProps> = ({
  currentTrack,
  isPlaying,
  playbackProgress,
  onPlayPause,
  onSkip,
  onSeek,
  isOwner,
}) => {
  const handleProgressBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isOwner || !currentTrack?.duration_ms) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const seekPercentage = clickX / width;
      const seekPositionMs = Math.floor(
        seekPercentage * currentTrack.duration_ms
      );
      onSeek(seekPositionMs);
    },
    [isOwner, currentTrack?.duration_ms, onSeek]
  );
  return (
    <div className="bg-black/10 p-3 rounded-lg shadow shadow-white">
      {currentTrack ? (
        <div className="space-y-2">
          {/* Top section with song info */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 relative overflow-hidden rounded">
              <img
                src={currentTrack.album.imageUrl}
                alt={currentTrack.album.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium text-white/90 truncate">
                {currentTrack.name}
              </h2>
              <p className="text-xs text-white/70 truncate">
                {currentTrack.artists.map((a) => a.name).join(", ")}
              </p>
            </div>

            {isOwner && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onPlayPause}
                  className="text-white/90 p-1 rounded hover:bg-white/10 transition-all duration-200"
                >
                  {isPlaying ? "⏸️" : "▶️"}
                </button>
                <button
                  onClick={onSkip}
                  className="text-white/90 p-1 rounded hover:bg-white/10 transition-all duration-200"
                >
                  ⏭️
                </button>
              </div>
            )}
          </div>

          {/* Progress bar section */}
          <div className="space-y-1">
            <div
              className="h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group relative"
              onClick={isOwner ? handleProgressBarClick : undefined}
            >
              <div
                className="h-full bg-orange-400/80 transition-all duration-100 group-hover:bg-orange-400"
                style={{
                  width: `${(playbackProgress / (currentTrack.duration_ms || 1)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/60 px-0.5">
              <span>{formatDuration(playbackProgress)}</span>
              <span>{formatDuration(currentTrack.duration_ms || 0)}</span>
            </div>{" "}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-white/60">No track playing</p>
        </div>
      )}
    </div>
  );
};
