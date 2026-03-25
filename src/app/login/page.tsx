"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, full_name: email.split("@")[0] };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (data.session?.access_token) {
        localStorage.setItem("access_token", data.session.access_token);
        localStorage.setItem("refresh_token", data.session.refresh_token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      if (data.user?.role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <a href="/">
            <img src="/logo.png" alt="ClawForLife" className="h-16 w-auto mx-auto mb-4 logo-glow" />
          </a>
          <h1 className="text-xl font-bold text-white">
            {mode === "login" ? "Sign In" : "Create Account"}
          </h1>
          <p className="text-white/30 text-sm mt-1">
            {mode === "login" ? "Access your ClawForLife dashboard" : "Get started with ClawForLife"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#121215] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#D42B2B]/50 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-[#121215] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#D42B2B]/50 transition-colors"
              placeholder="8+ characters"
            />
          </div>

          {error && (
            <div className="bg-[#D42B2B]/10 border border-[#D42B2B]/30 rounded-lg px-4 py-2 text-sm text-[#FF4444]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D42B2B] hover:bg-[#A51C1C] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button onClick={() => { setMode("register"); setError(""); }} className="text-[#D42B2B] hover:underline">
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-[#D42B2B] hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
