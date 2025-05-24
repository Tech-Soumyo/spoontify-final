"use client";
import { Canvas } from "@react-three/fiber";
import HeadsetModel from "@/components/custom/room/HeadsetModel";
import { OrbitControls } from "@react-three/drei";
import { Headphones, MessageSquare, Music, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
      delayChildren: 0.2,
    },
  },
};

export const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};
export default function Page() {
  const [activeTab, setActiveTab] = useState<"how" | "features">("how");
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white overflow-hidden">
      <section className="relative flex items-center min-h-screen">
        <div className="container mx-40 px-6 max-w-screen-xl py-10">
          <div className="flex flex-col lg:flex-row items-center lg:items-center justify-between gap-36">
            {/* Left Content */}
            <div className="lg:w-1/2 z-10 space-y-6">
              <div className="flex items-center space-x-2 text-spotify-green font-medium text-base">
                <Music className="text-green-500" size={22} />
                <span className="text-green-500">
                  Next Generation Music Rooms
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                🎧 Collaborative <br />{" "}
                <span className="text-green-300">Music</span> Rooms
              </h1>

              <p className="text-lg md:text-xl text-zinc-300 max-w-md">
                Suggest songs. Vote together. Let the music flow. Join the
                future of collaborative music listening.
              </p>

              <div className="flex flex-wrap gap-4 ">
                <button
                  className="bg-[#1DB954] hover:bg-green-600 hover:bg-opacity-80 text-white px-6 py-2.5 rounded-full 
    font-medium transition-all duration-300 ease-in-out cursor-pointer"
                >
                  Get Started
                </button>
                <button
                  className="border border-white hover:bg-white/10 hover:bg-opacity-10 text-white 
    px-6 py-2.5 rounded-full font-medium transition-all duration-300 ease-in-out cursor-pointer"
                >
                  Learn More
                </button>
              </div>
            </div>{" "}
            {/* 3D Canvas */}
            <div className="lg:w-1/2 h-[700px] relative pt-36">
              {" "}
              <Canvas
                camera={{
                  position: [0, 2, 25],
                  fov: 45,
                  near: 0.1,
                  far: 1000,
                }}
                gl={{ preserveDrawingBuffer: true }}
                style={{ width: "100%", height: "100%", position: "absolute" }}
              >
                <HeadsetModel />
                <OrbitControls
                  enableZoom={false}
                  autoRotate={true}
                  autoRotateSpeed={1}
                  minPolarAngle={Math.PI / 2.5}
                  maxPolarAngle={Math.PI / 1.8}
                />
              </Canvas>
            </div>
          </div>
        </div>
      </section>
      <motion.section
        className="w-full py-24 bg-gradient-to-b from-zinc-900/80 via-zinc-800/80 to-zinc-900/80 backdrop-blur-lg relative overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f20_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f20_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] z-[-1]" />

        <div className="container relative mx-auto px-4 md:px-6 z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-green-300 to-spoontify-purple bg-clip-text text-transparent">
              Why Choose Spoontify?
            </h2>
            <p className="text-gray-300 max-w-3xl mx-auto text-lg">
              Experience music in a whole new way with features designed for
              social listening
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <motion.div
              className="group flex flex-col items-center text-center p-8 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-800/50 backdrop-blur-xl shadow-lg shadow-black/10 hover:shadow-xl hover:border-zinc-700 transition-all duration-300 hover:scale-105"
              variants={itemVariants}
            >
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-spoontify-purple/20 to-green-500/20 mb-6 transform transition-transform duration-300 group-hover:scale-110">
                <Music className="text-green-400 h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">
                Collaborative Playlists
              </h3>
              <p className="text-zinc-400">
                Let everyone suggest songs and build the perfect playlist
                together.
              </p>
            </motion.div>

            <motion.div
              className="group flex flex-col items-center text-center p-8 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-800/50 backdrop-blur-xl shadow-lg shadow-black/10 hover:shadow-xl hover:border-zinc-700 transition-all duration-300 hover:scale-105"
              variants={itemVariants}
            >
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-spoontify-purple/20 to-green-500/20 mb-6 transform transition-transform duration-300 group-hover:scale-110">
                <Users className="text-green-400 h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">
                Music Rooms
              </h3>
              <p className="text-zinc-400">
                Create or join music rooms with friends or discover new ones.
              </p>
            </motion.div>

            <motion.div
              className="group flex flex-col items-center text-center p-8 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-800/50 backdrop-blur-xl shadow-lg shadow-black/10 hover:shadow-xl hover:border-zinc-700 transition-all duration-300 hover:scale-105"
              variants={itemVariants}
            >
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-spoontify-purple/20 to-green-500/20 mb-6 transform transition-transform duration-300 group-hover:scale-110">
                <MessageSquare className="text-green-400 h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">
                Real-time Chat
              </h3>
              <p className="text-zinc-400">
                Chat, share images, and create polls with room members.
              </p>
            </motion.div>

            <motion.div
              className="group flex flex-col items-center text-center p-8 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-800/50 backdrop-blur-xl shadow-lg shadow-black/10 hover:shadow-xl hover:border-zinc-700 transition-all duration-300 hover:scale-105"
              variants={itemVariants}
            >
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-spoontify-purple/20 to-green-500/20 mb-6 transform transition-transform duration-300 group-hover:scale-110">
                <Headphones className="text-green-400 h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">
                Spotify Integration
              </h3>
              <p className="text-zinc-400">
                Connect your Spotify Premium account and control playback
                seamlessly.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>
      <motion.section className="w-full py-24 relative">
        <div className="container mx-auto px-4 md:px-6">
          {/* Tabs */}
          <div className="flex justify-center gap-4 mb-12">
            <button
              onClick={() => setActiveTab("how")}
              className={`px-8 py-3 rounded-lg transition-all duration-300 backdrop-blur-xl border ${
                activeTab === "how"
                  ? "bg-zinc-700 text-white border-zinc-500"
                  : "bg-zinc-800/50 text-white hover:bg-zinc-700/50 border-zinc-700/30"
              }`}
            >
              How It Works
            </button>
            <button
              onClick={() => setActiveTab("features")}
              className={`px-8 py-3 rounded-lg transition-all duration-300 backdrop-blur-xl border ${
                activeTab === "features"
                  ? "bg-zinc-700 text-white border-zinc-500"
                  : "bg-zinc-800/50 text-white hover:bg-zinc-700/50 border-zinc-700/30"
              }`}
            >
              Features
            </button>
          </div>

          {/* How It Works Section */}
          {activeTab === "how" && (
            <motion.div
              key="how"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto bg-zinc-900/50 backdrop-blur-xl p-8 rounded-2xl border border-zinc-800"
            >
              <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-green-300 to-spoontify-purple bg-clip-text text-transparent">
                How Spoontify Works
              </h2>
              <div className="space-y-6">
                {[
                  {
                    number: "1",
                    title: "Sign up or log in to Spoontify",
                    description:
                      "Create an account or sign in with Spotify to get started.",
                  },
                  {
                    number: "2",
                    title: "Create or join a room",
                    description:
                      "Create a room (requires Spotify Premium) or join an existing room with a code.",
                  },
                  {
                    number: "3",
                    title: "Add songs to the queue",
                    description:
                      "Search for songs and add them to the room's collaborative queue.",
                  },
                  {
                    number: "4",
                    title: "Interact with other listeners",
                    description:
                      "Chat, create polls, and share images with other room members.",
                  },
                  {
                    number: "5",
                    title: "Enjoy music together",
                    description:
                      "Room host controls playback on their Spotify account while everyone enjoys the collaborative experience.",
                  },
                ].map((step, index) => (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-zinc-600/30 transition-all duration-300"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-spoontify-purple/20 to-green-500/20 text-green-400 font-semibold">
                      {step.number}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-zinc-400">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Features Section */}
          {activeTab === "features" && (
            <motion.div
              key="features"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            >
              {[
                {
                  title: "Song Suggestions",
                  description:
                    "Search and suggest songs from Spotify's vast library to add to the room's queue.",
                },
                {
                  title: "Real-time Chat",
                  description:
                    "Chat with other room members in real-time while listening to music together.",
                },
                {
                  title: "Song Polls",
                  description:
                    "Create polls to let the room vote on song suggestions before adding them to the queue.",
                },
                {
                  title: "Image Sharing",
                  description:
                    "Share images in the chat with other room members to enhance your conversations.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-zinc-600/30 transition-all duration-300 backdrop-blur-xl"
                >
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400">{feature.description}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* Waitlist Section */}
      <motion.section
        className="w-full py-24 bg-gradient-to-b from-zinc-900/80 via-zinc-800/80 to-zinc-900/80 backdrop-blur-lg relative overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f20_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f20_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] z-[-1]" />

        <div className="container relative mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-300 to-spoontify-purple bg-clip-text text-transparent">
                Join the Waitlist
              </h2>
              <p className="text-gray-300 max-w-3xl mx-auto text-lg">
                Be the first to experience our collaborative music platform
              </p>
            </div>

            <form
              onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  firstName: formData.get("firstName"),
                  lastName: formData.get("lastName"),
                  email: formData.get("email"),
                  contactNumber: formData.get("contactNumber"),
                  interest: formData.get("interest"),
                  comments: formData.get("comments"),
                };

                // You can implement your API call here
                console.log("Form submitted:", data);
                // TODO: Add your API endpoint call here
              }}
              className="space-y-6 backdrop-blur-xl bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 shadow-lg hover:shadow-xl hover:border-zinc-700 transition-all duration-300"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div variants={itemVariants}>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    required
                    className="w-full h-12 bg-white/5 border border-zinc-700/30 hover:border-zinc-600/50 rounded-lg px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500/50 transition-colors duration-200"
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    required
                    className="w-full h-12 bg-white/5 border border-zinc-700/30 hover:border-zinc-600/50 rounded-lg px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500/50 transition-colors duration-200"
                  />
                </motion.div>
              </div>

              <motion.div variants={itemVariants}>
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  required
                  className="w-full h-12 bg-white/5 border border-zinc-700/30 hover:border-zinc-600/50 rounded-lg px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500/50 transition-colors duration-200"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <input
                  type="tel"
                  name="contactNumber"
                  placeholder="Contact Number"
                  required
                  className="w-full h-12 bg-white/5 border border-zinc-700/30 hover:border-zinc-600/50 rounded-lg px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500/50 transition-colors duration-200"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <select
                  name="interest"
                  required
                  defaultValue=""
                  className="w-full h-12 bg-white/5 border border-zinc-700/30 hover:border-zinc-600/50 rounded-lg px-4 text-zinc-400 focus:outline-none focus:border-green-500/50 transition-colors duration-200"
                >
                  <option value="" disabled>
                    Select your interest
                  </option>
                  <option value="host" className="bg-zinc-800 text-white">
                    Business Owner
                  </option>
                  <option value="join" className="bg-zinc-800 text-white">
                    Individual with spotify Premium
                  </option>
                  <option value="both" className="bg-zinc-800 text-white">
                    Individual without spotify Premium
                  </option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants}>
                <textarea
                  name="comments"
                  placeholder="Additional comments or questions"
                  rows={4}
                  className="w-full bg-white/5 border border-zinc-700/30 hover:border-zinc-600/50 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500/50 transition-colors duration-200 resize-none"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <button
                  type="submit"
                  className="w-full h-12 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  Join Waitlist
                </button>
              </motion.div>
            </form>

            <motion.div
              variants={itemVariants}
              className="text-center mt-8 text-zinc-400"
            >
              <a
                href="mailto:soumyo.tech.deep@gmail.com"
                className="hover:text-white transition-colors duration-200"
              >
                soumyo.tech.deep@gmail.com
              </a>
              <p className="mt-2 text-sm">
                © 2025 TechKing. All rights reserved.
              </p>
              <div className="flex justify-center gap-4 mt-4">
                <Link
                  href={
                    "https://www.linkedin.com/in/soumyodeep-dutta-699a1a204"
                  }
                  className="text-zinc-400 hover:text-white transition-colors duration-200"
                >
                  <LinkedInIcon />
                </Link>
                <Link
                  href={"https://x.com/Soumyodeep60298"}
                  className="text-zinc-400 hover:text-white transition-colors duration-200"
                >
                  <TwitterIcon />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
