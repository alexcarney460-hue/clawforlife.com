"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface PricingCardProps {
  tier: "phone" | "package";
  name: string;
  price: string;
  priceId: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export default function PricingCard({
  tier,
  name,
  price,
  priceId,
  tagline,
  features,
  highlight = false,
}: PricingCardProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, tier }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`relative rounded-2xl p-[1px] ${
        highlight
          ? "bg-gradient-to-b from-[#D42B2B] via-[#A51C1C] to-transparent"
          : "bg-gradient-to-b from-[#333] to-transparent"
      }`}
    >
      {highlight && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#D42B2B] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
          Most Popular
        </div>
      )}
      <div className="bg-[#121215] rounded-2xl p-8 h-full flex flex-col">
        <h3 className="text-lg font-semibold text-white/60 uppercase tracking-widest">{name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-5xl font-bold text-white">{price}</span>
          <span className="text-white/40 text-sm">one-time</span>
        </div>
        <p className="mt-3 text-[#FF4444]/80 text-sm">{tagline}</p>

        <ul className="mt-8 space-y-3 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/70">
              <span className="text-[#D42B2B] mt-0.5 shrink-0">▸</span>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className={`mt-8 w-full py-4 rounded-xl font-semibold text-sm uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            highlight
              ? "bg-[#D42B2B] text-white hover:bg-[#A51C1C] hover:shadow-[0_0_30px_rgba(212,43,43,0.3)]"
              : "bg-white/5 text-white border border-white/10 hover:border-[#D42B2B]/50 hover:text-[#D42B2B]"
          } disabled:opacity-50`}
        >
          {loading ? "Processing..." : "Order Now"}
        </button>
      </div>
    </motion.div>
  );
}
