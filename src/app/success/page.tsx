"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const type = params.get("type");

  const messages: Record<string, { title: string; detail: string }> = {
    phone: {
      title: "Phone Order Confirmed",
      detail:
        "Your Samsung Galaxy A16 5G with OpenClaw will ship within 2 business days. You'll receive tracking via email.",
    },
    package: {
      title: "Full Package Confirmed",
      detail:
        "Your phone ships within 2 business days. Our team will email you within 24 hours to schedule your 90-min onboarding and confirm your 5 skill selections.",
    },
    skills: {
      title: "Skills Purchased",
      detail:
        "Your skills will be configured and installed on your OpenClaw device. If you already have a phone, we'll reach out with installation instructions.",
    },
  };

  const msg = messages[type || "phone"] || messages.phone;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-lg"
    >
      <img src="/logo.png" alt="OpenClaw Phones" className="h-24 w-auto mx-auto mb-6 logo-glow" />
      <h1 className="text-3xl font-bold mb-4">
        <span className="text-[#D42B2B]">{msg.title}</span>
      </h1>
      <p className="text-white/50 mb-2">{msg.detail}</p>
      <p className="text-white/30 text-sm mb-8">
        Check your email for a receipt from Stripe.
      </p>

      <div className="bg-[#121215] border border-[#D42B2B]/20 rounded-xl p-6 text-left font-mono text-sm mb-8">
        <div className="text-[#D42B2B]">$ openclaw order-status</div>
        <div className="text-white/50 mt-2">Payment confirmed ✓</div>
        <div className="text-white/50">Order received ✓</div>
        {type === "phone" || type === "package" ? (
          <>
            <div className="text-white/50">Phone provisioning ✓</div>
            <div className="text-white/50">Agent configuration ✓</div>
            <div className="text-white/50">Shipping label ⏳</div>
            <div className="text-[#FF4444] mt-2">ETA: 2-3 business days</div>
          </>
        ) : (
          <>
            <div className="text-white/50">Skills queued for install ✓</div>
            <div className="text-[#FF4444] mt-2">Configuration in progress...</div>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/"
          className="text-[#D42B2B] text-sm hover:underline"
        >
          ← Back to OpenClaw
        </Link>
        <Link
          href="/marketplace"
          className="text-white/40 text-sm hover:text-white/60"
        >
          Browse more skills →
        </Link>
      </div>
    </motion.div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Suspense
        fallback={
          <div className="text-[#D42B2B] font-mono text-sm cursor-blink">Loading</div>
        }
      >
        <SuccessContent />
      </Suspense>
    </main>
  );
}
