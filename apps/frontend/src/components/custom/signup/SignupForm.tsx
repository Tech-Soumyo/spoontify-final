"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { signIn, useSession } from "next-auth/react";
import axios from "axios";

export default function SignUpForm() {
  const [rememberMe, setRememberMe] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="name"
          value={formData.name}
          onChange={handleChange}
          name="name"
          required
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          name="email"
          required
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          name="password"
          required
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="number"
          placeholder="Number"
          value={formData.phone}
          onChange={handleChange}
          name="phone"
          required
          className="h-12"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
          />
          <label
            htmlFor="remember"
            className="text-sm text-gray-600 cursor-pointer"
          >
            Remember me
          </label>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 bg-purple-600 hover:bg-purple-700"
        disabled={loading}
        onClick={() => router.push("/createjoin")}
      >
        {loading ? "Signing up..." : "Sign Up"}
      </Button>
    </form>
  );
}
