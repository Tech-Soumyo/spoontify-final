"use client";
import { useSocket } from "@/hooks/Socket/useSocket.hook";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  isOwner?: boolean;
}

export function ChatSection({ roomCode }: { roomCode: string }) {
  const { socket, connectedUsers, isOwner } = useSocket(roomCode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<HTMLDivElement>(null);

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

  // Listen for new messages and chat history
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

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = () => {
    if (!newMessage.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    socket?.emit(
      "sendMessage",
      { roomCode, message: newMessage },
      (response: any) => {
        if (response.error) {
          toast.error(response.error);
        } else {
          setNewMessage("");
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
            {" "}
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
            <span className="text-white/90 font-medium">
              {connectedUsers[0]?.name || "Room Owner"}
            </span>
          </div>
          <span className="text-emerald-400/80 text-sm font-medium px-2 py-0.5 rounded-full bg-emerald-400/10">
            Host
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
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
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

      {/* Messages Section */}
      <div className="flex-1 space-y-4 p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="group backdrop-blur-md bg-white/5 rounded-lg p-3 border border-white/10 "
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400/90 font-medium">
                {msg.userName}
              </span>
              <span className="text-white/40 text-xs">
                {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
            <p className="text-white/90 mt-1">{msg.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 text-white/90 placeholder-white/40 rounded-lg px-4 py-2 border border-white/10 focus:outline-none focus:border-white/30 transition-colors"
          />
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
