"use client";

import { track } from "@/hooks/useSpotySong"; // Ensure correct import (useSpotifySong if typo)
import { Button } from "../ui/button";
import { useCallback } from "react";

type NowPlayingProps = {
  currentTrack: track | null;
  isPlaying: boolean;
  playbackProgress: number;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (positionMs: number) => void; // New prop for seeking
  isOwner: boolean;
};

// Format duration in MM:SS
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
  // Handle progress bar click for seeking
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
    <div className="p-4 bg-gray-700 text-white rounded-lg shadow-md m-4">
      {currentTrack ? (
        <>
          <h2 className="text-xl font-semibold">{currentTrack.name}</h2>
          <img
            src={currentTrack.album.imageUrl}
            alt={currentTrack.album.name}
            width={100} // Increased size for better visibility
            height={100}
            className="mt-2"
          />
          <p className="text-sm text-gray-400">
            {formatDuration(Number(currentTrack.duration_ms))}
          </p>
          <div
            className={`w-full bg-gray-600 rounded-full h-2.5 mt-2 ${
              isOwner ? "cursor-pointer hover:bg-gray-500" : ""
            }`}
            onClick={isOwner ? handleProgressBarClick : undefined}
          >
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-100"
              style={{
                width: `${
                  currentTrack.duration_ms
                    ? (playbackProgress / currentTrack.duration_ms) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>
          {isOwner && (
            <div className="flex space-x-4 mt-4">
              <button
                onClick={onPlayPause}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                onClick={onSkip}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Skip
              </button>
              {/* Debug button (remove in production) */}
              <Button
                onClick={() => {
                  console.log("Playback progress:", playbackProgress);
                }}
              >
                Progress
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-300">No track is currently playing.</p>
      )}
    </div>
  );
};
