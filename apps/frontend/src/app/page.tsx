"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { toast } from "sonner";
import SignUpForm from "@/components/custom/signup/SignupForm";
import Image from "next/image";
import img2 from "../../public/login.jpg";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { data: session, status } = useSession();

  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await axios.post("/api/auth/signup", formData);
      setMessage(res.data.message);
      setErrors({});
      const signInRes = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      if (signInRes?.error) {
        setMessage("Failed to sign in after signup");
      } else {
        router.push("/createjoin");
      }
    } catch (error: any) {
      if (error.response?.data?.error instanceof Array) {
        const formattedErrors: { [key: string]: string } = {};
        error.response.data.error.forEach((err: any) => {
          formattedErrors[err.path[0]] = err.message;
        });
        setErrors(formattedErrors);
      } else {
        setMessage(error.response?.data?.error || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      toast.error(`You are already logged in`);
      router.push("/createjoin");
    }
  }, [status, router]);
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Holla,</h1>
            <h2 className="text-3xl font-bold mb-4">Welcome Back</h2>
            <p className="text-gray-500">Login to Spoontify</p>
          </div>

          <SignUpForm />

          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{" "}
            <a
              href="/login"
              className="text-purple-600 font-medium hover:underline"
            >
              Sign In
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

/*<div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center">Sign Up</h2>
      {message && <p className="text-center mt-2 text-red-500">{message}</p>}
      <form onSubmit={handleSubmit} className="mt-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 p-2 w-full border rounded-md"
          />
          {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="mt-1 p-2 w-full border rounded-md"
          />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email}</p>
          )}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="mt-1 p-2 w-full border rounded-md"
          />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password}</p>
          )}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium">Phone</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="mt-1 p-2 w-full border rounded-md"
          />
          {errors.phone && (
            <p className="text-red-500 text-sm">{errors.phone}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`mt-4 w-full p-2 bg-blue-600 text-white rounded-md ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
        <p className="mt-2 text-center">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-blue-600 underline"
          >
            Log In
          </button>
        </p>
      </form>
    </div>*/
