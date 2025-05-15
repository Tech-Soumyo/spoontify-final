"use client";

import { track } from "@/hooks/useSpotySong";

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
  <div className="p-4">
    <h2 className="text-xl font-semibold text-white/90 mb-4">Songs</h2>
    {queue.length === 0 ? (
      <p className="text-white/70">No songs in your hearing list.</p>
    ) : (
      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {queue.map((queuedTrack, index) => (
          <div
            key={index}
            className="backdrop-blur-md bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition group"
          >
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-white/90 font-medium truncate">
                  {queuedTrack.name}
                </p>
                <p className="text-sm text-white/60 truncate">
                  {queuedTrack.artists
                    .map((artist: any) => artist.name)
                    .join(", ")}
                </p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onPlayTrack(queuedTrack)}
                    className="bg-white/10 hover:bg-white/20 text-white/90 px-3 py-1.5 rounded-md text-sm font-medium transition"
                  >
                    Play
                  </button>
                  <button
                    onClick={() => onRemoveTrack && onRemoveTrack(queuedTrack)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-md text-sm font-medium transition"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
