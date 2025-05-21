// searchSection.tsx
"use client";

import { track } from "@/hooks/useSpotySong";
import { useSocket } from "@/hooks/Socket/useSocket.hook"; // Import useSocket
import { useState } from "react";
import { toast } from "sonner"; // Import toast for notifications

type SearchSectionProps = {
  onSearch: (query: string) => void;
  searchResults: track[];
  onAddToQueue: (track: track) => void;
  loading: boolean;
  error: string | null;
  onShowResultsChange?: (showing: boolean) => void;
  roomCode: string; // Add roomCode prop
};

export const SearchSection: React.FC<SearchSectionProps> = ({
  onSearch,
  searchResults,
  onAddToQueue,
  loading,
  error,
  onShowResultsChange,
  roomCode, // Destructure roomCode
}) => {
  const { createPoll } = useSocket(roomCode); // Use useSocket with roomCode
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    setShowResults(true);
    onShowResultsChange?.(true);
  };

  const handleClose = () => {
    setShowResults(false);
    setQuery("");
    onShowResultsChange?.(false);
  };

  const handleCreatePoll = (track: track) => {
    createPoll(
      roomCode,
      {
        trackId: track.id,
        songName: track.name,
        artistName: track.artists.map((a) => a.name),
        albumName: track.album.name,
        imageUrl: track.album.imageUrl,
      },
      (response) => {
        if (response.error) {
          toast.error(response.error);
        } else {
          toast.success(`Poll created for ${track.name}`);
        }
      }
    );
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs..."
          className="w-full h-12 bg-transparent text-white/90 placeholder-white/70 outline-none text-center"
        />
      </form>

      {/* Results Section */}
      {showResults && (loading || searchResults.length > 0 || error) && (
        <div className="absolute left-0 right-0 mt-2 backdrop-blur-md bg-black/20 rounded-xl border border-white/30 shadow-lg overflow-hidden z-50">
          <div className="flex justify-end p-2 border-b border-white/10">
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white/90 transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {loading && (
            <div className="p-4 text-center">
              <p className="text-white/70">Searching...</p>
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="group p-4 hover:bg-white/10 transition-all border-b border-white/10 flex items-center gap-4"
                >
                  {result.album.imageUrl && (
                    <img
                      src={result.album.imageUrl}
                      alt={result.album.name}
                      className="w-12 h-12 rounded-md"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 font-medium truncate">
                      {result.name}
                    </p>
                    <p className="text-sm text-white/60 truncate">
                      {result.artists.map((artist) => artist.name).join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAddToQueue(result)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white/90 px-4 py-1.5 rounded-full text-sm font-medium"
                    >
                      Add to Queue
                    </button>
                    <button
                      onClick={() => handleCreatePoll(result)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-sm font-medium"
                    >
                      Create Poll
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
