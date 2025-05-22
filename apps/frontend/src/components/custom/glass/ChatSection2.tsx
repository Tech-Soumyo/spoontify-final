"use client";
import { useSocket, Poll } from "@/hooks/Socket/useSocket.hook";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import axios from "axios";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
}

const PollMessage = ({ poll, roomCode }: { poll: Poll; roomCode: string }) => {
  const { votePoll, closePoll } = useSocket(roomCode);
  const { data: session } = useSession();
  const userId = session?.user?.userId;

  const handleVote = (vote: boolean) => {
    votePoll(roomCode, poll.id, vote, (response) => {
      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success(`Voted ${vote ? "Yes" : "No"}`);
      }
    });
  };

  const handleClosePoll = () => {
    closePoll(roomCode, poll.id, (response) => {
      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success(
          response.addedToQueue
            ? `Poll closed: Song added to queue (${response.yesPercentage?.toFixed(
                1
              )}% Yes)`
            : `Poll closed: Song not added (${response.yesPercentage?.toFixed(
                1
              )}% Yes)`
        );
      }
    });
  };

  const yesVotes = poll.votes.filter((v) => v.vote).length;
  const totalVotes = poll.votes.length;
  const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
  const hasVoted = poll.votes.some((v) => v.userId === userId);

  return (
    <div className="group backdrop-blur-md bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
      <div className="flex items-center gap-2">
        <span className="text-blue-400 font-medium">{poll.createdByName}</span>
        <span className="text-white/40 text-xs">
          {new Date(poll.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </span>
      </div>
      <p className="text-white/90 mt-1">
        Poll: {poll.songName} by{" "}
        {Array.isArray(poll.artistName)
          ? poll.artistName.join(", ")
          : poll.artistName}
      </p>
      {poll.imageUrl && (
        <img
          src={poll.imageUrl}
          alt={poll.albumName}
          className="w-12 h-12 rounded-md mt-2"
        />
      )}
      <p className="text-white/70 text-sm mt-1">
        Yes Votes: {yesPercentage.toFixed(1)}% ({yesVotes}/{totalVotes})
      </p>
      {!poll.closed && !hasVoted && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handleVote(true)}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1 rounded-md text-sm"
          >
            Vote Yes
          </button>
          <button
            onClick={() => handleVote(false)}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded-md text-sm"
          >
            Vote No
          </button>
        </div>
      )}
      {!poll.closed && poll.createdById === userId && (
        <button
          onClick={handleClosePoll}
          className="mt-2 bg-white/10 hover:bg-white/20 text-white/90 px-3 py-1 rounded-md text-sm"
        >
          Close Poll
        </button>
      )}
      {poll.closed && <p className="text-white/70 text-sm mt-1">Poll Closed</p>}
    </div>
  );
};

export function ChatSection({ roomCode }: { roomCode: string }) {
  const { socket, connectedUsers, isOwner, polls } = useSocket(roomCode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close participants dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        participantsRef.current &&
        !participantsRef.current.contains(event.target as Node)
      ) {
        setShowParticipants(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Listen for new messages, chat history, and polls
  useEffect(() => {
    if (!socket) return;

    socket.on("newMessage", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("chatHistory", (history: ChatMessage[]) => {
      setMessages(history);
    });

    return () => {
      socket.off("newMessage");
      socket.off("chatHistory");
    };
  }, [socket]);

  // Auto-scroll to the latest message or poll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, polls]);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !image) {
      toast.error("Please enter a message or select an image");
      return;
    }

    let imageUrl: string | undefined;

    if (image) {
      try {
        const formData = new FormData();
        formData.append("image", image);
        const response = await axios.post("/api/room/image", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        imageUrl = response.data.imageUrl;
      } catch (error) {
        toast.error("Failed to upload image");
        return;
      }
    }

    socket?.emit(
      "sendMessage",
      { roomCode, message: newMessage.trim() || undefined, imageUrl },
      (response: any) => {
        if (response.error) {
          toast.error(response.error);
        } else {
          setNewMessage("");
          setImage(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }
    );
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/90 font-medium">
              {connectedUsers[0]?.name || "Room Owner"}
            </span>
          </div>
          <span className="text-emerald-400/80 text-sm font-medium px-2 py-0.5 rounded-full bg-emerald-400/10">
            Admin
          </span>
        </div>

        {/* Participants Dropdown */}
        <div className="relative" ref={participantsRef}>
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors px-3 py-1.5 rounded-lg text-white/90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/70"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{connectedUsers.length}</span>
          </button>

          {/* Participants List */}
          {showParticipants && (
            <div className="absolute right-0 mt-2 w-48 bg-black/80 backdrop-blur-lg rounded-lg border border-white/10 shadow-xl z-50">
              <div className="p-2">
                {connectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-md"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-white/90 text-sm">
                      {user.name}
                      {isOwner && user.id === connectedUsers[0]?.id && (
                        <span className="ml-1 text-emerald-400/80 text-xs">
                          (Host)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Messages and Polls Section */}
      <div className="flex-1 space-y-4 p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
        {[...messages, ...polls]
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
          .map((item) => {
            if ("content" in item) {
              // Render chat message
              return (
                <div
                  key={item.id}
                  className="group backdrop-blur-md bg-white/5 rounded-lg p-3 border border-white/10"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400/90 font-medium">
                      {item.userName}
                    </span>
                    <span className="text-white/40 text-xs">
                      {new Date(item.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  {item.content && (
                    <p className="text-white/90 mt-1">{item.content}</p>
                  )}{" "}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt="Chat image"
                      className="mt-2 max-w-[200px] h-auto rounded-md hover:opacity-90 transition-opacity cursor-pointer"
                      onClick={() => window.open(item.imageUrl!, "_blank")}
                      loading="lazy"
                    />
                  )}
                </div>
              );
            } else {
              // Render poll
              return (
                <PollMessage
                  key={item.id}
                  poll={item as Poll}
                  roomCode={roomCode}
                />
              );
            }
          })}
        <div ref={messagesEndRef} />
      </div>{" "}
      <div className="p-4 border-t border-white/10">
        {image && (
          <div className="mb-2 relative inline-block">
            <img
              src={URL.createObjectURL(image)}
              alt="Preview"
              className="h-20 w-auto rounded-md border border-white/20"
            />
            <button
              onClick={() => {
                setImage(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="absolute -top-2 -right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 text-white/90 placeholder-white/40 rounded-lg px-4 py-2 border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
          />
          <label className="bg-white/5 hover:bg-white/10 text-white/90 px-4 py-2 rounded-lg cursor-pointer border border-white/10 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleImageChange}
              ref={fileInputRef}
              className="hidden"
            />
            📷
          </label>
          <button
            onClick={handleSendMessage}
            className="bg-white/10 hover:bg-white/20 text-white/90 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
