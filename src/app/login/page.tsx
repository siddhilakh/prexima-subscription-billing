"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    router.push("/pricing");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">{isSignup ? "Sign up" : "Log in"}</h1>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-md p-2 mb-3"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
          required
        />

        <button type="submit" className="w-full bg-orange-400 text-white rounded-md py-2 mb-3">
          {isSignup ? "Sign up" : "Log in"}
        </button>

        <button
          type="button"
          onClick={() => setIsSignup(!isSignup)}
          className="text-sm text-gray-500 underline w-full text-center"
        >
          {isSignup ? "Already have an account? Log in" : "Need an account? Sign up"}
        </button>
      </form>
    </div>
  );
}