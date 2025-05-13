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
    <div className="mt-4 bg-gray-800 p-4 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Chat</h2>
      <div className="chat-messages h-64 overflow-y-auto bg-gray-700 p-2 rounded">
        {messages.map((msg) => (
          <div key={msg.id} className="message mb-2">
            <span className="font-bold text-green-400">{msg.userName}: </span>
            <span>{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input flex mt-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 p-2 rounded-l bg-gray-600 text-white placeholder-gray-400 focus:outline-none"
        />
        <button
          onClick={handleSendMessage}
          className="p-2 bg-green-500 text-white rounded-r hover:bg-green-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}
