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

export function ChatSection({ roomCode }: { roomCode: string }) {
  const { socket } = useSocket(roomCode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      <div className="flex-1 space-y-4 p-4 overflow-y-auto max-h-[70vh]">
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
                {new Date(msg.createdAt).toLocaleTimeString()}
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
