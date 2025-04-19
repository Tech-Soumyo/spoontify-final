// components/QueueStats.tsx
export const QueueStats = ({ count }: { count: number }) => {
  return (
    <div className="flex items-center gap-2 text-gray-400">
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16m-7 6h7"
        />
      </svg>
      <span>
        {count} {count === 1 ? "song" : "songs"} in queue
      </span>
    </div>
  );
};
