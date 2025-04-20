"use client";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
};

type HeaderProps = {
  roomCode: string;
  connectedUsers: User[];
  onLeave: () => void;
};

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  connectedUsers,
  onLeave,
}) => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (connectedUsers && connectedUsers.length > 0) {
      setUsers(connectedUsers);
      console.log("Connected Users Updated:", connectedUsers);
    }
  }, [connectedUsers]);

  return (
    <div className="flex justify-between items-center p-4 bg-gray-800 text-white shadow-md">
      <div>
        <h1 className="text-2xl font-bold mb-2">Room: {roomCode}</h1>
        <p className="text-sm mb-2">Connected Users: {users.length}</p>
        <div className="space-y-1">
          {users.map((user) => (
            <p key={user.id} className="text-sm text-gray-300">
              {user.name}
            </p>
          ))}
        </div>
      </div>

      <Button
        onClick={onLeave}
        variant="destructive"
        className="bg-red-500 hover:bg-red-600"
      >
        Leave Room
      </Button>
    </div>
  );
};
