"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }

    localStorage.setItem("clawforlife_token", data.session.access_token);
    localStorage.setItem("clawforlife_user", JSON.stringify(data.user));
    window.location.href = "/admin";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="ClawForLife" style={{ height: 64, margin: "0 auto 16px" }} />
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Sign In</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="Email"
            style={{ width: "100%", padding: "12px 16px", marginBottom: 12, background: "#121215", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
            placeholder="Password"
            style={{ width: "100%", padding: "12px 16px", marginBottom: 12, background: "#121215", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
          />
          {error && <div style={{ color: "#ff4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: 12, background: "#D42B2B", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
