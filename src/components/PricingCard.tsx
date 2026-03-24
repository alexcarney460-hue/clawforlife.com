"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "./CartProvider";

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
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);

  const priceInCents = tier === "phone" ? 22500 : 129900;
  const alreadyInCart = items.some((i) => i.id === tier);

  const handleAdd = () => {
    if (alreadyInCart) {
      window.location.href = "/cart";
      return;
    }
    addItem({
      id: tier,
      name: tier === "phone" ? "OpenClaw Phone — Samsung Galaxy A16 5G" : "OpenClaw Full Agent Package",
      price: priceInCents,
      type: tier,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
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
          onClick={handleAdd}
          className={`mt-8 w-full py-4 rounded-xl font-semibold text-sm uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            added
              ? "bg-green-600 text-white"
              : alreadyInCart
              ? "bg-white/10 text-[#D42B2B] border border-[#D42B2B]/30"
              : highlight
              ? "bg-[#D42B2B] text-white hover:bg-[#A51C1C] hover:shadow-[0_0_30px_rgba(212,43,43,0.3)]"
              : "bg-white/5 text-white border border-white/10 hover:border-[#D42B2B]/50 hover:text-[#D42B2B]"
          }`}
        >
          {added ? "✓ Added to Cart" : alreadyInCart ? "View Cart" : "Add to Cart"}
        </button>
      </div>
    </motion.div>
  );
}
