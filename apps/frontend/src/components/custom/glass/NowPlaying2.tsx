"use client";

import { track } from "@/hooks/useSpotySong";
import { useCallback, useState } from "react";
import { VolumeX, Volume2, Volume } from "lucide-react";

type NowPlayingProps = {
  currentTrack: track | null;
  isPlaying: boolean;
  playbackProgress: number;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (positionMs: number) => void;
  isOwner: boolean;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
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
  volume = 1,
  onVolumeChange,
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

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

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onVolumeChange) {
        const newVolume = parseFloat(e.target.value);
        onVolumeChange(newVolume);
      }
    },
    [onVolumeChange]
  );

  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={16} />;
    if (volume < 0.5) return <Volume size={16} />;
    return <Volume2 size={16} />;
  };

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
                {/* Volume control toggle button */}
                <button
                  onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  className="text-white/90 p-1 rounded hover:bg-white/10 transition-all duration-200"
                >
                  {getVolumeIcon()}
                </button>
              </div>
            )}
          </div>

          {/* Volume control slider */}
          {isOwner && showVolumeSlider && (
            <div className="flex items-center gap-2 mt-1 mb-2">
              <VolumeX size={14} className="text-white/70" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400"
              />
              <Volume2 size={14} className="text-white/70" />
            </div>
          )}

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
