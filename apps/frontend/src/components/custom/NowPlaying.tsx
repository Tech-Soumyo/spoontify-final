"use client";

import { track } from "@/hooks/useSpotySong";
import { Button } from "../ui/button";

type NowPlayingProps = {
  currentTrack: track | null;
  isPlaying: boolean;
  playbackProgress: number;
  onPlayPause: () => void;
  onSkip: () => void;
  isOwner: boolean;
};

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({
  currentTrack,
  isPlaying,
  playbackProgress,
  onPlayPause,
  onSkip,
  isOwner,
}) => {
  return (
    <div className="p-4 bg-gray-700 text-white rounded-lg shadow-md m-4">
      {currentTrack ? (
        <>
          <h2 className="text-xl font-semibold">{currentTrack.name}</h2>
          {/* <p className="text-gray-300">{currentTrack.album.imageUrl}</p> */}
          <img
            src={currentTrack.album.imageUrl}
            alt={currentTrack.album.name}
            width={50}
            height={50}
          />
          <p className="text-sm text-gray-400">
            {formatDuration(Number(currentTrack.duration_ms))}
          </p>
          <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
            <div
              className="bg-blue-500 h-2.5 rounded-full"
              style={{
                width: `${(playbackProgress / currentTrack.duration_ms!) * 100}%`,
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
              <Button
                onClick={() => {
                  console.log(playbackProgress);
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
