"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("clawforlife_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch("/api/auth/me", { headers: { Authorization: "Bearer " + token } })
      .then(r => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then(data => {
        if (data.user?.role === "admin") {
          setOk(true);
        } else {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        localStorage.removeItem("clawforlife_token");
        window.location.href = "/login";
      });
  }, []);

  if (!ok) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Verifying access...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0c" }}>
      <Sidebar />
      <main style={{ marginLeft: 256, minHeight: "100vh", padding: 32 }}>
        {children}
      </main>
    </div>
  );
}
