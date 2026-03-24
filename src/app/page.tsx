"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import PricingCard from "@/components/PricingCard";
import FeatureGrid from "@/components/FeatureGrid";
import TerminalDemo from "@/components/TerminalDemo";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

const PhoneScene = dynamic(() => import("@/components/PhoneScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[80vh] md:h-screen flex items-center justify-center bg-[#0a0a0c]">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="OpenClaw Phones" className="h-24 w-auto animate-pulse" />
        <div className="text-[#D42B2B] font-mono text-sm cursor-blink">Loading 3D Scene</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24">
        {/* 3D Phone */}
        <PhoneScene />

        {/* Hero text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 md:pb-24 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-center pointer-events-auto"
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              Your AI Army.
              <br />
              <span className="text-[#D42B2B]">In Your Pocket.</span>
            </h1>
            <p className="mt-4 text-white/50 text-base md:text-lg max-w-xl mx-auto px-6">
              Samsung phones preloaded with OpenClaw — autonomous agents that scrape leads,
              create content, send outreach, and run your CRM. Out of the box.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center px-6">
              <a
                href="#pricing"
                className="bg-[#D42B2B] text-white font-semibold px-8 py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_40px_rgba(212,43,43,0.3)] transition-all duration-300"
              >
                Get Yours — $225
              </a>
              <a
                href="#pricing"
                className="border border-white/10 text-white/70 font-semibold px-8 py-4 rounded-xl text-sm uppercase tracking-wider hover:border-[#D42B2B]/50 hover:text-[#D42B2B] transition-all duration-300"
              >
                Full Package — $1,299
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="py-8 border-y border-white/5">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16 px-6">
          {[
            { num: "47+", label: "Agent Skills" },
            { num: "1,800+", label: "Leads Scraped" },
            { num: "5", label: "Active Businesses" },
            { num: "24/7", label: "Autonomous" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-2xl font-bold text-[#D42B2B]">{s.num}</div>
              <div className="text-xs text-white/30 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <FeatureGrid />

      {/* Terminal Demo */}
      <TerminalDemo />

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Choose Your <span className="text-[#D42B2B]">Weapon</span>
          </h2>
          <p className="text-center text-white/40 mb-16">
            Both options ship with a brand new Samsung phone. No subscriptions. No hidden fees.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <PricingCard
              tier="phone"
              name="The Phone"
              price="$225"
              priceId="price_phone_225"
              tagline="OpenClaw installed. Just add your API keys."
              features={[
                "Brand new Samsung Galaxy A16 5G",
                "OpenClaw terminal pre-installed",
                "47+ agent skills loaded",
                "MCP server configuration",
                "Basic documentation & setup guide",
                "Unlocked — works on any carrier",
                "Email support",
              ]}
            />
            <PricingCard
              tier="package"
              name="Full Agent Package"
              price="$1,299"
              priceId="price_package_1299"
              tagline="Your complete autonomous revenue engine."
              highlight
              features={[
                "Everything in The Phone, plus:",
                "Complete CRM setup (Supabase-powered)",
                "Lead scraping pipeline configured",
                "SMS outreach system ready to send",
                "Content production pipeline (reels, posts)",
                "Social media automation (IG, TikTok)",
                "1-on-1 onboarding session (90 min)",
                "30 days priority support",
                "Custom agent skills for your business",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center bg-gradient-to-b from-[#121215] to-[#0a0a0c] border border-[#D42B2B]/10 rounded-2xl p-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Stop Building. Start <span className="text-[#D42B2B]">Deploying.</span>
          </h2>
          <p className="text-white/40 mb-8 max-w-lg mx-auto">
            Every day without automation is revenue left on the table. Your competitors are already using AI.
            The question isn&apos;t if — it&apos;s when.
          </p>
          <a
            href="#pricing"
            className="inline-block bg-[#D42B2B] text-white font-semibold px-10 py-4 rounded-xl text-sm uppercase tracking-wider hover:bg-[#A51C1C] hover:shadow-[0_0_40px_rgba(212,43,43,0.3)] transition-all duration-300"
          >
            Deploy Your Army
          </a>
        </motion.div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* Footer */}
      <Footer />
    </main>
  );
}
