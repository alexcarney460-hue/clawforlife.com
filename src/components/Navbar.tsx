"use client";

import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="OpenClaw Phones" className="h-10 w-auto" />
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
          <a href="#features" className="hover:text-[#00ff88] transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-[#00ff88] transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-[#00ff88] transition-colors">
            FAQ
          </a>
        </div>

        <a
          href="#pricing"
          className="bg-[#00ff88] text-black text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#00dd77] transition-colors"
        >
          Buy Now
        </a>
      </div>
    </motion.nav>
  );
}
