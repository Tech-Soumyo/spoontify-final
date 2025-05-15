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
    <div className="backdrop-blur-md bg-white/5 rounded-xl border border-white/10 p-4">
      {currentTrack ? (
        <div className="space-y-4">
          <div className="aspect-square w-full max-w-[300px] mx-auto relative overflow-hidden rounded-lg">
            <img
              src={currentTrack.album.imageUrl}
              alt={currentTrack.album.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-1 text-center">
            <h2 className="text-lg font-semibold text-white/90">
              {currentTrack.name}
            </h2>
            <p className="text-sm text-white/70">
              {currentTrack.artists.map((a) => a.name).join(", ")}
            </p>
          </div>

          <div className="space-y-2">
            <div
              className="h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
              onClick={isOwner ? handleProgressBarClick : undefined}
            >
              <div
                className="h-full bg-white/80 transition-all duration-100"
                style={{
                  width: `${(playbackProgress / (currentTrack.duration_ms || 1)) * 100}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-sm text-white/60">
              <span>{formatDuration(playbackProgress)}</span>
              <span>{formatDuration(currentTrack.duration_ms || 0)}</span>
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-center gap-4">
              <button
                onClick={onPlayPause}
                className="bg-white/10 hover:bg-white/20 text-white/90 px-6 py-2 rounded-full font-medium transition"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                onClick={onSkip}
                className="bg-white/10 hover:bg-white/20 text-white/90 px-6 py-2 rounded-full font-medium transition"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-white/60">No track playing</p>
        </div>
      )}
    </div>
  );
};
