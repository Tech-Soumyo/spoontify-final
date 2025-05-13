"use client";

import { track } from "@/hooks/useSpotySong";
import { useState } from "react";

type SearchSectionProps = {
  onSearch: (query: string) => void;
  searchResults: track[];
  onAddToQueue: (track: track) => void;
  loading: boolean;
  error: string | null;
};

export const SearchSection: React.FC<SearchSectionProps> = ({
  onSearch,
  searchResults,
  onAddToQueue,
  loading,
  error,
}) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <div className="p-4 m-4 bg-gray-800 rounded-lg shadow-md">
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs"
          className="flex-1 p-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          Search
        </button>
      </form>
      {loading && <p className="mt-2 text-gray-300">Loading...</p>}
      {error && <p className="mt-2 text-red-500">{error}</p>}
      <div className="mt-4 max-h-64 overflow-y-auto">
        {searchResults.map((track: track) => (
          <div
            key={track.id}
            className="flex justify-between items-center p-2 border-b border-gray-700 hover:bg-gray-600 transition"
          >
            <div>
              <p className="text-white">{track.name}</p>
              <p className="text-sm text-gray-400">
                {track.artists.map((artist) => artist.name).join(", ")} -{" "}
                {track.album.name}
              </p>
            </div>
            <button
              onClick={() => onAddToQueue(track)}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2 rounded-lg transition"
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
