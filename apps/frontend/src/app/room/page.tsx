"use client";
import Image from "next/image";
import img from "../../../public/interior.jpg";
import { track } from "@/hooks/useSpotySong";
import { NowPlaying } from "@/components/custom/glass/NowPlaying2";
import { QueueSection } from "@/components/custom/glass/QueueSection";
import { SearchSection } from "@/components/custom/glass/SearchSection2";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ChatSection } from "@/components/custom/glass/ChatSection2";

export default function Page() {
  const params = useParams();
  const roomId = params?.roomCode;
  const roomCode = Array.isArray(roomId) ? roomId[0] : roomId || "default-room";

  // Mock data for demonstration - you can replace these with real data later
  const mockQueue: track[] = [];
  const mockCurrentTrack: track | null = null;
  const isOwner = false;
  const [searchResults, setSearchResults] = useState<track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = (query: string) => {
    // Mock search function - replace with real implementation
    setSearchLoading(true);
    setTimeout(() => {
      setSearchLoading(false);
      setSearchResults([]);
    }, 1000);
  };

  const handleAddToQueue = (track: track) => {
    // Mock add to queue function - replace with real implementation
    console.log("Adding to queue:", track);
  };

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

      {/* Content Container with glass effect overlay */}
      <div className="relative h-full min-h-screen bg-white/10">
        <div className="container mx-auto p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sidebar with queue section & play section */}
            <div className="backdrop-blur-md bg-black/20 rounded-2xl w-full lg:w-[400px] h-auto lg:min-h-[90vh] mt-4 border border-white/30 shadow-lg flex flex-col">
              <div className="p-4 border-b border-white/20">
                <h1 className="text-2xl font-bold text-white/90 text-center">
                  SPOONIFY
                </h1>
              </div>

              {/* Now Playing Section */}
              <div className="p-4">
                <NowPlaying
                  currentTrack={mockCurrentTrack}
                  isPlaying={false}
                  playbackProgress={0}
                  onPlayPause={() => {}}
                  onSkip={() => {}}
                  onSeek={() => {}}
                  isOwner={isOwner}
                />
              </div>

              {/* Queue Section - with scrollable area */}
              <div className="flex-1 overflow-hidden">
                <QueueSection
                  queue={mockQueue}
                  isOwner={isOwner}
                  onPlayTrack={() => {}}
                  onRemoveTrack={() => {}}
                />
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Search Section */}
              <div className="backdrop-blur-md bg-white/20 rounded-xl w-full border border-white/30 shadow-lg relative">
                <SearchSection
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  onAddToQueue={handleAddToQueue}
                  loading={searchLoading}
                  error={searchError}
                />
              </div>

              {/* Chat area */}
              <div className="backdrop-blur-md bg-white/20 rounded-2xl flex-1 w-full min-h-[70vh] border border-white/30 shadow-lg">
                {roomCode && <ChatSection roomCode={roomCode} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
