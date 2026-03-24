"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg"
      >
        <img src="/logo.png" alt="OpenClaw Phones" className="h-24 w-auto mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-4">
          Order <span className="text-[#D42B2B]">Confirmed</span>
        </h1>
        <p className="text-white/50 mb-2">Your OpenClaw phone is being prepared.</p>
        <p className="text-white/30 text-sm mb-8">
          You&apos;ll receive a shipping confirmation email within 24 hours. For the Full Agent
          Package, our team will reach out to schedule your onboarding session.
        </p>

        <div className="bg-[#121215] border border-[#D42B2B]/20 rounded-xl p-6 text-left font-mono text-sm mb-8">
          <div className="text-[#D42B2B]">$ openclaw status</div>
          <div className="text-white/50 mt-2">Order received ✓</div>
          <div className="text-white/50">Phone provisioning ✓</div>
          <div className="text-white/50">Agent configuration ✓</div>
          <div className="text-white/50">Shipping label created ⏳</div>
          <div className="text-[#FF4444] mt-2">ETA: 2-3 business days</div>
        </div>

        <Link
          href="/"
          className="text-[#D42B2B] text-sm hover:underline"
        >
          ← Back to OpenClaw
        </Link>
      </motion.div>
    </main>
  );
}
