"use client";
import { FlowerSpinner } from "@/components/custom/SpinningFlower";
import CreateButton from "@/components/custom/createJoin/CreateButton";

export default function Page() {
  return (
    <div className="relative min-h-screen w-full bg-zinc-800">
      <div className="p-10">
        <CreateButton />
        <FlowerSpinner />
      </div>
    </div>
  );
}
