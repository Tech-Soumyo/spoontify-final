"use client";
import LoginForm from "@/components/custom/login/LoginForm";
import Image from "next/image";
import img2 from "../../../public/login.jpg";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Holla,</h1>
            <h2 className="text-3xl font-bold mb-4">Welcome Back</h2>
            <p className="text-gray-500">Login to Spoontify</p>
          </div>

          <LoginForm />

          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{" "}
            <a href="/" className="text-purple-600 font-medium hover:underline">
              Sign Up
            </a>
          </div>
        </div>

        <div className="hidden md:block bg-purple-500 relative">
          <div className="absolute inset-0 flex items-center justify-center ">
            <Image
              src={img2}
              alt="Login illustration"
              className="min-h-full min-w-full "
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-6 bg-white rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Login</h2>
        {error && <p className="text-red-500">{error}</p>}
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            className="p-2 border rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="p-2 border rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className={`p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          <p className="mt-2 text-center">
            Don’t have an account?{" "}
            <button
              onClick={() => router.push("/")}
              className="text-blue-500 underline"
            >
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>*/
