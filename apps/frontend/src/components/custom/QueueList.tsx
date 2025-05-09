"use client";

import { track } from "@/hooks/useSpotySong";
import { Button } from "../ui/button";

export const QueueSection = ({
  queue,
  isOwner,
  onPlayTrack,
  onRemoveTrack,
}: {
  queue: any[];
  isOwner: boolean;
  onPlayTrack: (track: track) => void;
  onRemoveTrack?: (track: track) => void;
}) => (
  <div className="p-4 m-4 bg-gray-800 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold text-white mb-2">Queue</h2>
    {queue.length === 0 ? (
      <p className="text-gray-300">No songs in queue.</p>
    ) : (
      <div className="max-h-64 overflow-y-auto">
        {queue.map((queuedTrack, index) => (
          <div
            key={index}
            className="flex justify-between items-center p-2 border-b border-gray-700 hover:bg-gray-600 transition"
          >
            <div>
              <p className="text-white">{queuedTrack.name}</p>
              <p className="text-sm text-gray-400">
                {queuedTrack.artists
                  .map((artist: any) => artist.name)
                  .join(", ")}{" "}
                - {queuedTrack.album.name}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  console.log("Is owner ?? ", isOwner);
                }}
              >
                Isowner: {JSON.stringify(isOwner)}
              </Button>
              {isOwner && (
                <>
                  <button
                    onClick={() => onPlayTrack(queuedTrack)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-lg transition"
                  >
                    Play Now
                  </button>
                  <button
                    onClick={() => onRemoveTrack && onRemoveTrack(queuedTrack)}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded-lg transition"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
