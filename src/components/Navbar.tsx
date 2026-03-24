"use client";

import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="OpenClaw Phones" className="h-16 md:h-20 w-auto" />
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
          <a href="#features" className="hover:text-[#D42B2B] transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-[#D42B2B] transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-[#D42B2B] transition-colors">
            FAQ
          </a>
        </div>

        <a
          href="#pricing"
          className="bg-[#D42B2B] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#A51C1C] transition-colors"
        >
          Buy Now
        </a>
      </div>
    </motion.nav>
  );
}
